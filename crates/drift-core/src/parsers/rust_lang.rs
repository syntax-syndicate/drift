//! Rust parser using native tree-sitter
//!
//! Extracts functions, structs, imports, and call sites from Rust code.
//! Supports Actix, Axum, Rocket, and other framework patterns.
//!
//! Enterprise features:
//! - #[derive(...)] attribute extraction (Debug, Clone, Serialize, etc.)
//! - #[serde(...)] attribute extraction (rename, skip, flatten, etc.)
//! - Route attributes (#[get("/")], #[post("/")], etc.) for Actix/Axum/Rocket
//! - Parameter extraction with types
//! - Return type extraction
//! - Doc comment extraction (/// and //!)
//! - Visibility modifiers (pub, pub(crate), etc.)
//! - Async function detection

use std::time::Instant;
use tree_sitter::{Node, Parser, Query, QueryCursor};

use super::types::*;

/// Rust parser
pub struct RustParser {
    parser: Parser,
    function_query: Query,
    struct_query: Query,
    use_query: Query,
    call_query: Query,
    attribute_query: Query,
}

impl RustParser {
    pub fn new() -> Result<Self, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_rust::LANGUAGE;
        parser.set_language(&language.into())
            .map_err(|e| format!("Failed to set language: {}", e))?;
        
        // Enhanced function query with parameters and return types
        let function_query = Query::new(
            &language.into(),
            r#"
            (function_item
                (visibility_modifier)? @visibility
                name: (identifier) @name
                parameters: (parameters) @params
                return_type: (_)? @return_type
                body: (block)? @body
            ) @function
            "#,
        ).map_err(|e| format!("Failed to create function query: {}", e))?;
        
        let struct_query = Query::new(
            &language.into(),
            r#"
            (struct_item
                (visibility_modifier)? @visibility
                name: (type_identifier) @name
                body: (field_declaration_list)? @fields
            ) @struct
            
            (enum_item
                (visibility_modifier)? @visibility
                name: (type_identifier) @name
                body: (enum_variant_list)? @variants
            ) @enum
            
            (trait_item
                (visibility_modifier)? @visibility
                name: (type_identifier) @name
            ) @trait
            
            (impl_item
                trait: (type_identifier)? @trait_name
                type: (type_identifier) @impl_type
                body: (declaration_list)? @impl_body
            ) @impl
            "#,
        ).map_err(|e| format!("Failed to create struct query: {}", e))?;

        let use_query = Query::new(
            &language.into(),
            r#"
            (use_declaration
                argument: (_) @use_path
            ) @use
            "#,
        ).map_err(|e| format!("Failed to create use query: {}", e))?;
        
        let call_query = Query::new(
            &language.into(),
            r#"
            (call_expression
                function: [
                    (identifier) @callee
                    (field_expression
                        value: (_) @receiver
                        field: (field_identifier) @callee
                    )
                    (scoped_identifier
                        path: (_) @receiver
                        name: (identifier) @callee
                    )
                ]
                arguments: (arguments) @args
            ) @call
            "#,
        ).map_err(|e| format!("Failed to create call query: {}", e))?;
        
        // Query for extracting attributes
        let attribute_query = Query::new(
            &language.into(),
            r#"
            (attribute_item
                (attribute
                    (identifier) @attr_name
                    arguments: (token_tree)? @attr_args
                )
            ) @attribute
            "#,
        ).map_err(|e| format!("Failed to create attribute query: {}", e))?;
        
        Ok(Self {
            parser,
            function_query,
            struct_query,
            use_query,
            call_query,
            attribute_query,
        })
    }
    
    pub fn parse(&mut self, source: &str) -> ParseResult {
        let start = Instant::now();
        
        let tree = match self.parser.parse(source, None) {
            Some(t) => t,
            None => {
                let mut result = ParseResult::new(Language::Rust);
                result.errors.push(ParseError {
                    message: "Failed to parse source".to_string(),
                    range: Range::new(0, 0, 0, 0),
                });
                return result;
            }
        };
        
        let root = tree.root_node();
        let source_bytes = source.as_bytes();
        
        let mut result = ParseResult::with_tree(Language::Rust, tree.clone());
        
        self.extract_functions(&root, source_bytes, &mut result);
        self.extract_structs(&root, source_bytes, &mut result);
        self.extract_uses(&root, source_bytes, &mut result);
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
            let mut is_pub = false;
            let mut is_async = false;
            let mut return_type: Option<String> = None;
            let mut parameters = Vec::new();
            let mut function_node: Option<Node> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.function_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "visibility" => {
                        let vis = node.utf8_text(source).unwrap_or("");
                        is_pub = vis.starts_with("pub");
                    }
                    "params" => {
                        parameters = self.extract_parameters(&node, source);
                    }
                    "return_type" => {
                        let rt = node.utf8_text(source).unwrap_or("").to_string();
                        // Clean up return type (remove leading "-> ")
                        let rt = rt.trim();
                        if !rt.is_empty() && rt != "->" {
                            return_type = Some(rt.trim_start_matches("->").trim().to_string());
                        }
                    }
                    "function" => {
                        range = node_range(&node);
                        function_node = Some(node);
                        // Check for async keyword
                        let text = node.utf8_text(source).unwrap_or("");
                        is_async = text.contains("async fn");
                    }
                    _ => {}
                }
            }
            
            if !name.is_empty() {
                // Extract attributes and doc comments
                let (decorators, doc_comment) = function_node
                    .map(|n| self.extract_attributes_and_docs(&n, source))
                    .unwrap_or((Vec::new(), None));
                
                result.functions.push(FunctionInfo {
                    name,
                    qualified_name: None,
                    parameters,
                    return_type,
                    is_exported: is_pub,
                    is_async,
                    is_generator: false,
                    range,
                    decorators,
                    doc_comment,
                });
            }
        }
    }

    fn extract_structs(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.struct_query, *root, source);
        
        for m in matches {
            let mut name = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_pub = false;
            let mut struct_node: Option<Node> = None;
            let mut properties = Vec::new();
            let mut is_trait = false;
            let mut trait_name: Option<String> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.struct_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" | "impl_type" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "visibility" => {
                        let vis = node.utf8_text(source).unwrap_or("");
                        is_pub = vis.starts_with("pub");
                    }
                    "fields" => {
                        properties = self.extract_struct_fields(&node, source);
                    }
                    "trait_name" => {
                        trait_name = Some(node.utf8_text(source).unwrap_or("").to_string());
                    }
                    "struct" | "enum" => {
                        range = node_range(&node);
                        struct_node = Some(node);
                    }
                    "trait" => {
                        range = node_range(&node);
                        struct_node = Some(node);
                        is_trait = true;
                    }
                    "impl" => {
                        // Skip impl blocks for now, they're handled separately
                        continue;
                    }
                    _ => {}
                }
            }
            
            if !name.is_empty() && struct_node.is_some() {
                // Extract attributes and doc comments
                let (decorators, _doc_comment) = struct_node
                    .map(|n| self.extract_attributes_and_docs(&n, source))
                    .unwrap_or((Vec::new(), None));
                
                result.classes.push(ClassInfo {
                    name,
                    extends: trait_name,
                    implements: Vec::new(),
                    is_exported: is_pub,
                    is_abstract: is_trait,
                    methods: Vec::new(),
                    properties,
                    range,
                    decorators,
                });
            }
        }
    }
    
    fn extract_uses(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.use_query, *root, source);
        
        for m in matches {
            let mut use_path = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.use_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "use_path" => {
                        use_path = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "use" => {
                        range = node_range(&node);
                    }
                    _ => {}
                }
            }
            
            if !use_path.is_empty() {
                result.imports.push(ImportInfo {
                    source: use_path,
                    named: Vec::new(),
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
    
    // ==================== ENTERPRISE FEATURE HELPERS ====================
    
    /// Extract parameters from a parameters node
    fn extract_parameters(&self, params_node: &Node, source: &[u8]) -> Vec<ParameterInfo> {
        let mut parameters = Vec::new();
        
        let mut cursor = params_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "parameter" => {
                        if let Some(param) = self.extract_single_parameter(&child, source) {
                            parameters.push(param);
                        }
                    }
                    "self_parameter" => {
                        // Handle self, &self, &mut self
                        let self_text = child.utf8_text(source).unwrap_or("self");
                        parameters.push(ParameterInfo {
                            name: "self".to_string(),
                            type_annotation: Some(self_text.to_string()),
                            default_value: None,
                            is_rest: false,
                        });
                    }
                    _ => {}
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        parameters
    }
    
    /// Extract a single parameter
    fn extract_single_parameter(&self, param_node: &Node, source: &[u8]) -> Option<ParameterInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        
        let mut cursor = param_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        name = child.utf8_text(source).unwrap_or("").to_string();
                    }
                    "mutable_specifier" => {
                        // Skip "mut" keyword
                    }
                    "reference_type" | "type_identifier" | "generic_type" | 
                    "array_type" | "tuple_type" | "primitive_type" | "scoped_type_identifier" => {
                        type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    _ => {
                        // For complex types, try to get the type from the node text
                        if child.kind().contains("type") || child.kind() == "_type" {
                            type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                        }
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        // If we didn't find a name but have text, try parsing the whole parameter
        if name.is_empty() {
            let param_text = param_node.utf8_text(source).unwrap_or("");
            // Pattern: "name: Type" or "mut name: Type"
            if let Some(colon_pos) = param_text.find(':') {
                let name_part = param_text[..colon_pos].trim();
                let type_part = param_text[colon_pos + 1..].trim();
                name = name_part.trim_start_matches("mut ").trim().to_string();
                if !type_part.is_empty() {
                    type_annotation = Some(type_part.to_string());
                }
            }
        }
        
        if name.is_empty() {
            return None;
        }
        
        Some(ParameterInfo {
            name,
            type_annotation,
            default_value: None, // Rust doesn't have default parameter values
            is_rest: false,
        })
    }
    
    /// Extract attributes and doc comments from a node
    fn extract_attributes_and_docs(&self, node: &Node, source: &[u8]) -> (Vec<String>, Option<String>) {
        let mut attributes = Vec::new();
        let mut doc_lines = Vec::new();
        
        // Look for attribute_item and line_comment siblings before this node
        let mut sibling = node.prev_sibling();
        while let Some(sib) = sibling {
            match sib.kind() {
                "attribute_item" => {
                    let attr_text = sib.utf8_text(source).unwrap_or("");
                    if !attr_text.is_empty() {
                        attributes.push(attr_text.to_string());
                    }
                }
                "line_comment" => {
                    let comment = sib.utf8_text(source).unwrap_or("");
                    // Check for doc comments (/// or //!)
                    if comment.starts_with("///") || comment.starts_with("//!") {
                        let doc_content = comment
                            .trim_start_matches("///")
                            .trim_start_matches("//!")
                            .trim();
                        doc_lines.push(doc_content.to_string());
                    }
                }
                _ => {
                    // Stop when we hit something that's not an attribute or comment
                    break;
                }
            }
            sibling = sib.prev_sibling();
        }
        
        // Reverse attributes and doc_lines since we collected them backwards
        attributes.reverse();
        doc_lines.reverse();
        
        let doc_comment = if doc_lines.is_empty() {
            None
        } else {
            Some(doc_lines.join("\n"))
        };
        
        (attributes, doc_comment)
    }
    
    /// Extract struct fields
    fn extract_struct_fields(&self, fields_node: &Node, source: &[u8]) -> Vec<PropertyInfo> {
        let mut properties = Vec::new();
        
        let mut cursor = fields_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "field_declaration" {
                    if let Some(prop) = self.extract_field(&child, source) {
                        properties.push(prop);
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        properties
    }
    
    /// Extract a single struct field
    fn extract_field(&self, field_node: &Node, source: &[u8]) -> Option<PropertyInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut visibility = Visibility::Private;
        let mut serde_tags = Vec::new();
        
        // Check for attributes on the field (like #[serde(rename = "...")])
        let (attrs, _doc) = self.extract_attributes_and_docs(field_node, source);
        for attr in &attrs {
            if let Some(tag) = self.parse_serde_attribute(attr) {
                serde_tags.push(tag);
            }
        }
        
        let mut cursor = field_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "visibility_modifier" => {
                        let vis = child.utf8_text(source).unwrap_or("");
                        if vis.starts_with("pub") {
                            visibility = Visibility::Public;
                        }
                    }
                    "field_identifier" => {
                        name = child.utf8_text(source).unwrap_or("").to_string();
                    }
                    _ => {
                        // Try to capture type
                        if child.kind().contains("type") || child.kind() == "type_identifier" 
                            || child.kind() == "generic_type" || child.kind() == "reference_type" {
                            type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                        }
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        if name.is_empty() {
            return None;
        }
        
        Some(PropertyInfo {
            name,
            type_annotation,
            is_static: false,
            is_readonly: false, // Rust fields are mutable by default unless the struct is immutable
            visibility,
            tags: if serde_tags.is_empty() { None } else { Some(serde_tags) },
        })
    }
    
    /// Parse serde attribute into a StructTag
    fn parse_serde_attribute(&self, attr: &str) -> Option<StructTag> {
        // Match patterns like #[serde(rename = "name")] or #[serde(skip)]
        if !attr.contains("serde") {
            return None;
        }
        
        // Extract the content inside serde(...)
        if let Some(start) = attr.find("serde(") {
            let rest = &attr[start + 6..];
            if let Some(end) = rest.find(')') {
                let content = &rest[..end];
                return Some(StructTag {
                    key: "serde".to_string(),
                    value: content.to_string(),
                });
            }
        }
        
        None
    }
    
    /// Extract route attributes for web frameworks (Actix, Axum, Rocket)
    #[allow(dead_code)]
    fn extract_route_info(&self, attrs: &[String]) -> Option<(String, String)> {
        for attr in attrs {
            // Actix-web: #[get("/path")], #[post("/path")], etc.
            // Rocket: #[get("/path")], #[post("/path")], etc.
            let methods = ["get", "post", "put", "delete", "patch", "head", "options"];
            for method in methods {
                let pattern = format!("#[{}(", method);
                if attr.to_lowercase().contains(&pattern) {
                    // Extract path from attribute
                    if let Some(start) = attr.find('(') {
                        if let Some(end) = attr.rfind(')') {
                            let path = attr[start + 1..end]
                                .trim()
                                .trim_matches('"')
                                .to_string();
                            return Some((method.to_uppercase(), path));
                        }
                    }
                }
            }
            
            // Axum: Uses Router::route() instead of attributes, but check for route macro
            if attr.contains("route") {
                if let Some(start) = attr.find('(') {
                    if let Some(end) = attr.rfind(')') {
                        let content = &attr[start + 1..end];
                        return Some(("ROUTE".to_string(), content.to_string()));
                    }
                }
            }
        }
        None
    }
}

impl Default for RustParser {
    fn default() -> Self {
        Self::new().expect("Failed to create Rust parser")
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
        let mut parser = RustParser::new().unwrap();
        let result = parser.parse("pub fn hello(name: &str) -> String { name.to_string() }");
        
        assert_eq!(result.functions.len(), 1);
        assert_eq!(result.functions[0].name, "hello");
        assert!(result.functions[0].is_exported);
    }

    #[test]
    fn test_parse_struct() {
        let mut parser = RustParser::new().unwrap();
        let result = parser.parse("pub struct User { name: String }");
        
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "User");
    }

    #[test]
    fn test_parse_use_statements() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
            use std::collections::HashMap;
            use serde::{Serialize, Deserialize};
            use crate::models::User;
            
            fn main() { }
        "#;
        let result = parser.parse(source);
        
        assert!(result.imports.len() >= 3);
        assert!(result.imports.iter().any(|i| i.source.contains("HashMap")));
    }

    #[test]
    fn test_parse_derive_attributes() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
#[derive(Debug, Clone, Serialize)]
pub struct User {
    pub name: String,
}
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "User");
        assert!(result.classes[0].decorators.iter().any(|d| d.contains("derive")),
            "Expected derive attribute, got: {:?}", result.classes[0].decorators);
        assert!(result.classes[0].decorators.iter().any(|d| d.contains("Debug")),
            "Expected Debug in derive, got: {:?}", result.classes[0].decorators);
    }

    #[test]
    fn test_parse_impl_block() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
            struct User { name: String }
            
            impl User {
                pub fn new(name: String) -> Self {
                    Self { name }
                }
                
                pub fn get_name(&self) -> &str {
                    &self.name
                }
            }
        "#;
        let result = parser.parse(source);
        
        assert!(result.functions.iter().any(|f| f.name == "new"));
        assert!(result.functions.iter().any(|f| f.name == "get_name"));
    }

    #[test]
    fn test_parse_trait() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
            pub trait Repository {
                fn save(&self, entity: &Entity) -> Result<(), Error>;
                fn find(&self, id: i64) -> Option<Entity>;
            }
        "#;
        let result = parser.parse(source);
        
        // Traits are parsed - check that parsing succeeded
        assert!(result.errors.is_empty());
        // Trait should be detected as a class
        assert!(!result.classes.is_empty());
    }

    #[test]
    fn test_parse_async_function() {
        let mut parser = RustParser::new().unwrap();
        let source = "pub async fn fetch_data() -> Result<Data, Error> { Ok(Data::default()) }";
        let result = parser.parse(source);
        
        assert_eq!(result.functions.len(), 1);
        assert!(result.functions[0].is_async);
    }

    #[test]
    fn test_parse_method_calls() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
            fn process() {
                let result = db.query("SELECT * FROM users");
                println!("done");
            }
        "#;
        let result = parser.parse(source);
        
        assert!(result.calls.iter().any(|c| c.callee == "query"));
    }

    #[test]
    fn test_parse_enum() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
            #[derive(Debug)]
            pub enum Status {
                Active,
                Inactive,
                Pending,
            }
        "#;
        let result = parser.parse(source);
        
        // Enums are parsed as classes
        assert!(!result.classes.is_empty());
        assert!(result.classes.iter().any(|c| c.name == "Status"));
    }

    #[test]
    fn test_parse_private_function() {
        let mut parser = RustParser::new().unwrap();
        let source = "fn helper() { }";
        let result = parser.parse(source);
        
        assert_eq!(result.functions.len(), 1);
        assert!(!result.functions[0].is_exported);
    }
    
    // ==================== NEW ENTERPRISE FEATURE TESTS ====================
    
    #[test]
    fn test_parse_function_parameters() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
pub fn create_user(name: String, age: u32, active: bool) -> User {
    User { name, age, active }
}
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.functions.len(), 1);
        let func = &result.functions[0];
        assert_eq!(func.name, "create_user");
        assert!(func.parameters.len() >= 3, "Expected 3 parameters, got: {:?}", func.parameters);
        
        // Check parameter names and types
        assert!(func.parameters.iter().any(|p| p.name == "name"), 
            "Expected 'name' parameter, got: {:?}", func.parameters);
        assert!(func.parameters.iter().any(|p| p.name == "age"),
            "Expected 'age' parameter, got: {:?}", func.parameters);
        assert!(func.parameters.iter().any(|p| p.name == "active"),
            "Expected 'active' parameter, got: {:?}", func.parameters);
    }
    
    #[test]
    fn test_parse_function_return_type() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
pub fn find_user(id: i64) -> Option<User> {
    None
}

pub fn get_all() -> Vec<User> {
    vec![]
}

pub fn delete(id: i64) {
}
        "#;
        let result = parser.parse(source);
        
        let find_user = result.functions.iter().find(|f| f.name == "find_user").unwrap();
        assert!(find_user.return_type.is_some(), "Expected return type for find_user");
        assert!(find_user.return_type.as_ref().unwrap().contains("Option"),
            "Expected Option return type, got: {:?}", find_user.return_type);
        
        let get_all = result.functions.iter().find(|f| f.name == "get_all").unwrap();
        assert!(get_all.return_type.is_some(), "Expected return type for get_all");
        assert!(get_all.return_type.as_ref().unwrap().contains("Vec"),
            "Expected Vec return type, got: {:?}", get_all.return_type);
        
        let delete = result.functions.iter().find(|f| f.name == "delete").unwrap();
        assert!(delete.return_type.is_none(), "Expected no return type for delete");
    }
    
    #[test]
    fn test_parse_serde_attributes() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDto {
    #[serde(rename = "userId")]
    pub id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default)]
    pub active: bool,
}
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.classes.len(), 1);
        let class = &result.classes[0];
        assert_eq!(class.name, "UserDto");
        
        // Check for derive attribute
        assert!(class.decorators.iter().any(|d| d.contains("derive")),
            "Expected derive attribute, got: {:?}", class.decorators);
        assert!(class.decorators.iter().any(|d| d.contains("Serialize")),
            "Expected Serialize in derive, got: {:?}", class.decorators);
        
        // Check for serde attribute
        assert!(class.decorators.iter().any(|d| d.contains("serde")),
            "Expected serde attribute, got: {:?}", class.decorators);
        assert!(class.decorators.iter().any(|d| d.contains("rename_all")),
            "Expected rename_all in serde, got: {:?}", class.decorators);
    }
    
    #[test]
    fn test_parse_actix_route_attributes() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
use actix_web::{get, post, web, HttpResponse};

#[get("/users/{id}")]
pub async fn get_user(path: web::Path<i64>) -> HttpResponse {
    HttpResponse::Ok().finish()
}

#[post("/users")]
pub async fn create_user(body: web::Json<CreateUserDto>) -> HttpResponse {
    HttpResponse::Created().finish()
}
        "#;
        let result = parser.parse(source);
        
        let get_user = result.functions.iter().find(|f| f.name == "get_user").unwrap();
        assert!(get_user.decorators.iter().any(|d| d.contains("get")),
            "Expected #[get] attribute, got: {:?}", get_user.decorators);
        assert!(get_user.decorators.iter().any(|d| d.contains("/users/")),
            "Expected route path in attribute, got: {:?}", get_user.decorators);
        assert!(get_user.is_async, "Expected async function");
        
        let create_user = result.functions.iter().find(|f| f.name == "create_user").unwrap();
        assert!(create_user.decorators.iter().any(|d| d.contains("post")),
            "Expected #[post] attribute, got: {:?}", create_user.decorators);
    }
    
    #[test]
    fn test_parse_doc_comments() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
/// Creates a new user in the database.
/// 
/// # Arguments
/// * `name` - The user's name
/// * `email` - The user's email address
///
/// # Returns
/// The newly created user
pub fn create_user(name: String, email: String) -> User {
    User { name, email }
}
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.functions.len(), 1);
        let func = &result.functions[0];
        assert!(func.doc_comment.is_some(), "Expected doc comment");
        let doc = func.doc_comment.as_ref().unwrap();
        assert!(doc.contains("Creates a new user"), "Expected doc content, got: {}", doc);
    }
    
    #[test]
    fn test_parse_struct_fields() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
pub struct User {
    pub id: i64,
    pub name: String,
    email: Option<String>,
    pub active: bool,
}
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.classes.len(), 1);
        let class = &result.classes[0];
        assert!(!class.properties.is_empty(), "Expected struct fields as properties");
        
        // Check field visibility
        let id_field = class.properties.iter().find(|p| p.name == "id");
        assert!(id_field.is_some(), "Expected 'id' field");
        assert_eq!(id_field.unwrap().visibility, Visibility::Public);
        
        let email_field = class.properties.iter().find(|p| p.name == "email");
        assert!(email_field.is_some(), "Expected 'email' field");
        assert_eq!(email_field.unwrap().visibility, Visibility::Private);
    }
    
    #[test]
    fn test_parse_self_parameter() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
impl User {
    pub fn get_name(&self) -> &str {
        &self.name
    }
    
    pub fn set_name(&mut self, name: String) {
        self.name = name;
    }
    
    pub fn into_dto(self) -> UserDto {
        UserDto { name: self.name }
    }
}
        "#;
        let result = parser.parse(source);
        
        let get_name = result.functions.iter().find(|f| f.name == "get_name").unwrap();
        assert!(get_name.parameters.iter().any(|p| p.name == "self"),
            "Expected self parameter, got: {:?}", get_name.parameters);
        
        let set_name = result.functions.iter().find(|f| f.name == "set_name").unwrap();
        assert!(set_name.parameters.iter().any(|p| p.name == "self"),
            "Expected self parameter, got: {:?}", set_name.parameters);
    }
    
    #[test]
    fn test_parse_generic_function() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
pub fn find_by_id<T: Entity>(id: i64) -> Option<T> {
    None
}
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.functions.len(), 1);
        let func = &result.functions[0];
        assert_eq!(func.name, "find_by_id");
        assert!(func.return_type.is_some());
    }
    
    #[test]
    fn test_parse_result_return_type() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
pub async fn fetch_data() -> Result<Vec<User>, ApiError> {
    Ok(vec![])
}
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.functions.len(), 1);
        let func = &result.functions[0];
        assert!(func.is_async);
        assert!(func.return_type.as_ref().unwrap().contains("Result"),
            "Expected Result return type, got: {:?}", func.return_type);
    }
    
    #[test]
    fn test_parse_multiple_attributes() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
#[derive(Debug, Clone)]
#[serde(rename_all = "camelCase")]
#[sqlx(rename_all = "snake_case")]
pub struct Config {
    pub database_url: String,
}
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.classes.len(), 1);
        let class = &result.classes[0];
        assert!(class.decorators.len() >= 3, 
            "Expected at least 3 attributes, got: {:?}", class.decorators);
    }
    
    #[test]
    fn test_parse_rocket_routes() {
        let mut parser = RustParser::new().unwrap();
        let source = r#"
#[get("/hello/<name>")]
pub fn hello(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[post("/users", data = "<user>")]
pub fn create(user: Json<User>) -> Status {
    Status::Created
}
        "#;
        let result = parser.parse(source);
        
        let hello = result.functions.iter().find(|f| f.name == "hello").unwrap();
        assert!(hello.decorators.iter().any(|d| d.contains("get")),
            "Expected #[get] attribute, got: {:?}", hello.decorators);
        
        let create = result.functions.iter().find(|f| f.name == "create").unwrap();
        assert!(create.decorators.iter().any(|d| d.contains("post")),
            "Expected #[post] attribute, got: {:?}", create.decorators);
    }
}
