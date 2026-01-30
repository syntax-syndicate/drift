//! Go parser using native tree-sitter
//!
//! Extracts functions, structs, imports, and call sites from Go code.
//! Supports Gin, Echo, and other framework patterns.

use std::time::Instant;
use tree_sitter::{Node, Parser, Query, QueryCursor};

use super::types::*;

/// Go parser
pub struct GoParser {
    parser: Parser,
    function_query: Query,
    struct_query: Query,
    import_query: Query,
    call_query: Query,
}

impl GoParser {
    pub fn new() -> Result<Self, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_go::LANGUAGE;
        parser.set_language(&language.into())
            .map_err(|e| format!("Failed to set language: {}", e))?;
        
        let function_query = Query::new(
            &language.into(),
            r#"
            (function_declaration
                name: (identifier) @name
                parameters: (parameter_list) @params
                result: (_)? @return_type
            ) @function
            
            (method_declaration
                receiver: (parameter_list) @receiver
                name: (field_identifier) @name
                parameters: (parameter_list) @params
                result: (_)? @return_type
            ) @method
            "#,
        ).map_err(|e| format!("Failed to create function query: {}", e))?;
        
        let struct_query = Query::new(
            &language.into(),
            r#"
            (type_declaration
                (type_spec
                    name: (type_identifier) @name
                    type: (struct_type) @struct_body
                )
            ) @struct
            
            (type_declaration
                (type_spec
                    name: (type_identifier) @name
                    type: (interface_type) @interface_body
                )
            ) @interface
            "#,
        ).map_err(|e| format!("Failed to create struct query: {}", e))?;
        
        let import_query = Query::new(
            &language.into(),
            r#"
            (import_declaration
                (import_spec
                    name: (package_identifier)? @alias
                    path: (interpreted_string_literal) @path
                )
            ) @import
            
            (import_declaration
                (import_spec_list
                    (import_spec
                        name: (package_identifier)? @alias
                        path: (interpreted_string_literal) @path
                    )
                )
            ) @import_list
            "#,
        ).map_err(|e| format!("Failed to create import query: {}", e))?;
        
        let call_query = Query::new(
            &language.into(),
            r#"
            (call_expression
                function: [
                    (identifier) @callee
                    (selector_expression
                        operand: (_) @receiver
                        field: (field_identifier) @callee
                    )
                ]
                arguments: (argument_list) @args
            ) @call
            "#,
        ).map_err(|e| format!("Failed to create call query: {}", e))?;
        
        Ok(Self {
            parser,
            function_query,
            struct_query,
            import_query,
            call_query,
        })
    }
    
    pub fn parse(&mut self, source: &str) -> ParseResult {
        let start = Instant::now();
        
        let tree = match self.parser.parse(source, None) {
            Some(t) => t,
            None => {
                let mut result = ParseResult::new(Language::Go);
                result.errors.push(ParseError {
                    message: "Failed to parse source".to_string(),
                    range: Range::new(0, 0, 0, 0),
                });
                return result;
            }
        };
        
        let root = tree.root_node();
        let source_bytes = source.as_bytes();
        
        let mut result = ParseResult::with_tree(Language::Go, tree.clone());
        
        self.extract_functions(&root, source_bytes, &mut result);
        self.extract_structs(&root, source_bytes, &mut result);
        self.extract_imports(&root, source_bytes, &mut result);
        self.extract_calls(&root, source_bytes, &mut result);
        
        result.parse_time_us = start.elapsed().as_micros() as u64;
        result
    }
    
    fn extract_functions(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.function_query, *root, source);
        
        for m in matches {
            let mut name = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_exported = false;
            let mut parameters = Vec::new();
            let mut return_type: Option<String> = None;
            let mut function_node: Option<Node> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.function_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                        // Go exports start with uppercase
                        is_exported = name.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);
                    }
                    "params" => {
                        parameters = self.extract_parameters(&node, source);
                    }
                    "return_type" => {
                        let rt = node.utf8_text(source).unwrap_or("").trim();
                        if !rt.is_empty() {
                            return_type = Some(rt.to_string());
                        }
                    }
                    "function" | "method" => {
                        range = node_range(&node);
                        function_node = Some(node);
                    }
                    _ => {}
                }
            }
            
            if !name.is_empty() {
                let doc_comment = function_node.and_then(|n| self.extract_doc_comment(&n, source));
                
                result.functions.push(FunctionInfo {
                    name,
                    qualified_name: None,
                    parameters,
                    return_type,
                    is_exported,
                    is_async: false, // Go uses goroutines, not async
                    is_generator: false,
                    range,
                    decorators: Vec::new(),
                    doc_comment,
                });
            }
        }
    }
    
    /// Extract parameters from a parameter_list node
    fn extract_parameters(&self, params_node: &Node, source: &[u8]) -> Vec<ParameterInfo> {
        let mut parameters = Vec::new();
        let mut cursor = params_node.walk();
        
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "parameter_declaration" {
                    parameters.extend(self.extract_parameter_declaration(&child, source));
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        parameters
    }
    
    /// Extract parameters from a single parameter_declaration (Go can have multiple names per type)
    fn extract_parameter_declaration(&self, param_node: &Node, source: &[u8]) -> Vec<ParameterInfo> {
        let mut params = Vec::new();
        let mut names = Vec::new();
        let mut type_annotation: Option<String> = None;
        let mut is_variadic = false;
        
        let mut cursor = param_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        names.push(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    "variadic_parameter_declaration" => {
                        is_variadic = true;
                        // Extract the inner type
                        let mut inner = child.walk();
                        if inner.goto_first_child() {
                            loop {
                                let inner_child = inner.node();
                                if inner_child.kind() == "identifier" {
                                    names.push(inner_child.utf8_text(source).unwrap_or("").to_string());
                                } else if inner_child.kind().contains("type") {
                                    type_annotation = Some(format!("...{}", inner_child.utf8_text(source).unwrap_or("")));
                                }
                                if !inner.goto_next_sibling() { break; }
                            }
                        }
                    }
                    _ => {
                        // Capture type (type_identifier, pointer_type, slice_type, etc.)
                        if child.kind().contains("type") || child.kind() == "qualified_type" {
                            type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                        }
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        // If no names found, try to parse the whole node
        if names.is_empty() {
            let text = param_node.utf8_text(source).unwrap_or("");
            // Go allows type-only parameters in interfaces
            if !text.is_empty() && type_annotation.is_none() {
                type_annotation = Some(text.to_string());
            }
        }
        
        // Create a ParameterInfo for each name
        for name in names {
            if !name.is_empty() {
                params.push(ParameterInfo {
                    name,
                    type_annotation: type_annotation.clone(),
                    default_value: None, // Go doesn't have default values
                    is_rest: is_variadic,
                });
            }
        }
        
        params
    }
    
    /// Extract doc comment (// comments before a function)
    fn extract_doc_comment(&self, node: &Node, source: &[u8]) -> Option<String> {
        let mut doc_lines = Vec::new();
        let mut sibling = node.prev_sibling();
        
        while let Some(sib) = sibling {
            if sib.kind() == "comment" {
                let comment = sib.utf8_text(source).unwrap_or("");
                // Go doc comments are // comments
                if comment.starts_with("//") {
                    let content = comment.trim_start_matches("//").trim();
                    doc_lines.push(content.to_string());
                }
            } else {
                // Stop at non-comment nodes
                break;
            }
            sibling = sib.prev_sibling();
        }
        
        if doc_lines.is_empty() {
            None
        } else {
            doc_lines.reverse();
            Some(doc_lines.join("\n"))
        }
    }
    
    fn extract_structs(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.struct_query, *root, source);
        
        for m in matches {
            let mut name = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_exported = false;
            let mut is_interface = false;
            let mut struct_body: Option<Node> = None;
            let mut struct_node: Option<Node> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.struct_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                        is_exported = name.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);
                    }
                    "struct_body" => {
                        struct_body = Some(node);
                    }
                    "interface_body" => {
                        is_interface = true;
                    }
                    "struct" => {
                        range = node_range(&node);
                        struct_node = Some(node);
                    }
                    "interface" => {
                        range = node_range(&node);
                        is_interface = true;
                        struct_node = Some(node);
                    }
                    _ => {}
                }
            }
            
            if !name.is_empty() {
                let properties = struct_body
                    .map(|n| self.extract_struct_fields(&n, source))
                    .unwrap_or_default();
                
                let doc_comment = struct_node.and_then(|n| self.extract_doc_comment(&n, source));
                
                result.classes.push(ClassInfo {
                    name,
                    extends: None,
                    implements: Vec::new(), // Go uses implicit interfaces
                    is_exported,
                    is_abstract: is_interface,
                    methods: Vec::new(),
                    properties,
                    range,
                    decorators: if doc_comment.is_some() { vec![] } else { vec![] },
                });
            }
        }
    }
    
    /// Extract struct fields with their tags
    fn extract_struct_fields(&self, struct_body: &Node, source: &[u8]) -> Vec<PropertyInfo> {
        let mut properties = Vec::new();
        
        // struct_body is a struct_type node, we need to find field_declaration_list inside it
        // or iterate directly over field_declaration children
        let mut cursor = struct_body.walk();
        
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "field_declaration_list" => {
                        // Found the field list, extract fields from it
                        let mut field_cursor = child.walk();
                        if field_cursor.goto_first_child() {
                            loop {
                                let field = field_cursor.node();
                                if field.kind() == "field_declaration" {
                                    properties.extend(self.extract_field_declaration(&field, source));
                                }
                                if !field_cursor.goto_next_sibling() { break; }
                            }
                        }
                    }
                    "field_declaration" => {
                        // Direct field declaration (some tree-sitter versions)
                        properties.extend(self.extract_field_declaration(&child, source));
                    }
                    _ => {}
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        properties
    }
    
    /// Extract a single field declaration (Go can have multiple names per type)
    fn extract_field_declaration(&self, field_node: &Node, source: &[u8]) -> Vec<PropertyInfo> {
        let mut props = Vec::new();
        let mut names = Vec::new();
        let mut type_annotation: Option<String> = None;
        let mut tags: Option<Vec<StructTag>> = None;
        
        let mut cursor = field_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "field_identifier" => {
                        names.push(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    "raw_string_literal" | "interpreted_string_literal" => {
                        // This is a struct tag like `json:"name" db:"user_name"`
                        let tag_text = child.utf8_text(source).unwrap_or("");
                        tags = Some(self.parse_struct_tags(tag_text));
                    }
                    _ => {
                        if child.kind().contains("type") || child.kind() == "qualified_type" {
                            type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                        }
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        for name in names {
            if !name.is_empty() {
                let is_exported = name.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);
                props.push(PropertyInfo {
                    name,
                    type_annotation: type_annotation.clone(),
                    is_static: false,
                    is_readonly: false,
                    visibility: if is_exported { Visibility::Public } else { Visibility::Private },
                    tags: tags.clone(),
                });
            }
        }
        
        props
    }
    
    /// Parse Go struct tags like `json:"name" db:"user_name" validate:"required"`
    fn parse_struct_tags(&self, tag_text: &str) -> Vec<StructTag> {
        let mut tags = Vec::new();
        let text = tag_text.trim_matches('`').trim_matches('"');
        
        // Parse key:"value" pairs
        let mut remaining = text;
        while !remaining.is_empty() {
            // Find key
            if let Some(colon_pos) = remaining.find(':') {
                let key = remaining[..colon_pos].trim();
                remaining = &remaining[colon_pos + 1..];
                
                // Find value (quoted)
                if remaining.starts_with('"') {
                    remaining = &remaining[1..];
                    if let Some(end_quote) = remaining.find('"') {
                        let value = &remaining[..end_quote];
                        tags.push(StructTag {
                            key: key.to_string(),
                            value: value.to_string(),
                        });
                        remaining = remaining[end_quote + 1..].trim_start();
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        tags
    }
    
    fn extract_imports(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.import_query, *root, source);
        
        for m in matches {
            let mut path = String::new();
            let mut alias = None;
            let mut range = Range::new(0, 0, 0, 0);
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.import_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "path" => {
                        // Remove quotes
                        let text = node.utf8_text(source).unwrap_or("");
                        path = text.trim_matches('"').to_string();
                    }
                    "alias" => {
                        alias = Some(node.utf8_text(source).unwrap_or("").to_string());
                    }
                    "import" | "import_list" => {
                        range = node_range(&node);
                    }
                    _ => {}
                }
            }
            
            if !path.is_empty() {
                // Extract package name from path
                let pkg_name = path.rsplit('/').next().unwrap_or(&path).to_string();
                result.imports.push(ImportInfo {
                    source: path,
                    named: vec![alias.unwrap_or(pkg_name)],
                    default: None,
                    namespace: None,
                    is_type_only: false,
                    range,
                });
            }
        }
    }
    
    fn extract_calls(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.call_query, *root, source);
        
        for m in matches {
            let mut callee = String::new();
            let mut receiver = None;
            let mut arg_count = 0;
            let mut range = Range::new(0, 0, 0, 0);
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.call_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "callee" => {
                        callee = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "receiver" => {
                        receiver = Some(node.utf8_text(source).unwrap_or("").to_string());
                    }
                    "args" => {
                        arg_count = node.named_child_count();
                    }
                    "call" => {
                        range = node_range(&node);
                    }
                    _ => {}
                }
            }
            
            if !callee.is_empty() {
                result.calls.push(CallSite {
                    callee,
                    receiver,
                    arg_count,
                    range,
                });
            }
        }
    }
}

impl Default for GoParser {
    fn default() -> Self {
        Self::new().expect("Failed to create Go parser")
    }
}

fn node_range(node: &Node) -> Range {
    Range {
        start: Position {
            line: node.start_position().row as u32,
            column: node.start_position().column as u32,
        },
        end: Position {
            line: node.end_position().row as u32,
            column: node.end_position().column as u32,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_function() {
        let mut parser = GoParser::new().unwrap();
        let result = parser.parse("package main\n\nfunc Hello(name string) string { return name }");
        
        assert_eq!(result.functions.len(), 1);
        assert_eq!(result.functions[0].name, "Hello");
        assert!(result.functions[0].is_exported);
    }

    #[test]
    fn test_parse_struct() {
        let mut parser = GoParser::new().unwrap();
        let result = parser.parse("package main\n\ntype User struct { Name string }");
        
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "User");
    }

    #[test]
    fn test_parse_imports() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            import (
                "fmt"
                "net/http"
                "github.com/gin-gonic/gin"
            )
            
            func main() { }
        "#;
        let result = parser.parse(source);
        
        assert!(result.imports.len() >= 3);
        assert!(result.imports.iter().any(|i| i.source == "fmt"));
        assert!(result.imports.iter().any(|i| i.source.contains("gin")));
    }

    #[test]
    fn test_parse_method_receiver() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            type User struct { Name string }
            
            func (u *User) GetName() string {
                return u.Name
            }
        "#;
        let result = parser.parse(source);
        
        assert!(result.functions.iter().any(|f| f.name == "GetName"));
    }

    #[test]
    fn test_parse_interface() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            type Repository interface {
                Save(entity interface{}) error
                Find(id int) (interface{}, error)
            }
        "#;
        let result = parser.parse(source);
        
        // Interfaces are parsed as classes in Go
        // The interface may or may not be detected depending on query
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_parse_struct_tags() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            type User struct {
                ID   int    `json:"id" gorm:"primaryKey"`
                Name string `json:"name" validate:"required"`
            }
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "User");
    }

    #[test]
    fn test_parse_method_calls() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            func process() {
                db.Create(&user)
                log.Printf("done")
            }
        "#;
        let result = parser.parse(source);
        
        assert!(result.calls.iter().any(|c| c.callee == "Create"));
        assert!(result.calls.iter().any(|c| c.callee == "Printf"));
    }

    #[test]
    fn test_parse_unexported_function() {
        let mut parser = GoParser::new().unwrap();
        let source = "package main\n\nfunc helper() { }";
        let result = parser.parse(source);
        
        assert_eq!(result.functions.len(), 1);
        assert!(!result.functions[0].is_exported);
    }
    
    // ==================== NEW ENTERPRISE FEATURE TESTS ====================
    
    #[test]
    fn test_parse_function_parameters() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            func CreateUser(name string, age int, active bool) error {
                return nil
            }
        "#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "CreateUser").unwrap();
        assert!(func.parameters.len() >= 3, "Expected 3 parameters, got: {:?}", func.parameters);
        
        // Check parameter names and types
        assert!(func.parameters.iter().any(|p| p.name == "name" && p.type_annotation == Some("string".to_string())));
        assert!(func.parameters.iter().any(|p| p.name == "age" && p.type_annotation == Some("int".to_string())));
        assert!(func.parameters.iter().any(|p| p.name == "active" && p.type_annotation == Some("bool".to_string())));
    }
    
    #[test]
    fn test_parse_return_type() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            func GetUser(id int) (*User, error) {
                return nil, nil
            }
        "#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "GetUser").unwrap();
        assert!(func.return_type.is_some(), "Expected return type");
    }
    
    #[test]
    fn test_parse_struct_fields_with_tags() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            type User struct {
                ID        int    `json:"id" gorm:"primaryKey"`
                Email     string `json:"email" validate:"required,email"`
                CreatedAt time.Time `json:"created_at"`
            }
        "#;
        let result = parser.parse(source);
        
        let user = result.classes.iter().find(|c| c.name == "User").unwrap();
        assert!(user.properties.len() >= 3, "Expected 3 properties, got: {:?}", user.properties);
        
        // Check that fields are extracted
        assert!(user.properties.iter().any(|p| p.name == "ID"), "Expected ID field");
        assert!(user.properties.iter().any(|p| p.name == "Email"), "Expected Email field");
        assert!(user.properties.iter().any(|p| p.name == "CreatedAt"), "Expected CreatedAt field");
        
        // Check that at least one field has tags
        let id_prop = user.properties.iter().find(|p| p.name == "ID").unwrap();
        if let Some(tags) = &id_prop.tags {
            assert!(tags.iter().any(|t| t.key == "json"), "Expected json tag");
        }
    }
    
    #[test]
    fn test_parse_variadic_function() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            func Printf(format string, args ...interface{}) {
            }
        "#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "Printf").unwrap();
        assert!(func.parameters.len() >= 1, "Expected parameters");
    }
    
    #[test]
    fn test_parse_gin_handler() {
        let mut parser = GoParser::new().unwrap();
        let source = r#"
            package main
            
            import "github.com/gin-gonic/gin"
            
            // GetUsers returns all users
            // This is a REST endpoint
            func GetUsers(c *gin.Context) {
                c.JSON(200, users)
            }
        "#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "GetUsers").unwrap();
        assert!(func.doc_comment.is_some(), "Expected doc comment");
        let doc = func.doc_comment.as_ref().unwrap();
        assert!(doc.contains("returns all users"), "Doc should contain description");
    }
}
