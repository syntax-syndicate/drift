//! C parser using native tree-sitter
//!
//! Extracts functions, structs, includes, and call sites from C code.
//! Optimized for embedded systems and systems programming patterns.

use std::time::Instant;
use tree_sitter::{Node, Parser, Query, QueryCursor};

use super::types::*;

/// C parser
pub struct CParser {
    parser: Parser,
    function_query: Query,
    struct_query: Query,
    include_query: Query,
    call_query: Query,
}

impl CParser {
    pub fn new() -> Result<Self, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_c::LANGUAGE;
        parser.set_language(&language.into())
            .map_err(|e| format!("Failed to set language: {}", e))?;
        
        // Function definitions (including static functions common in embedded)
        let function_query = Query::new(
            &language.into(),
            r#"
            (function_definition
                declarator: (function_declarator
                    declarator: (identifier) @name
                    parameters: (parameter_list) @params
                )
                type: (_)? @return_type
            ) @function
            
            (function_definition
                declarator: (pointer_declarator
                    declarator: (function_declarator
                        declarator: (identifier) @name
                    )
                )
            ) @ptr_function
            "#,
        ).map_err(|e| format!("Failed to create function query: {}", e))?;
        
        // Structs, unions, enums, and typedefs
        let struct_query = Query::new(
            &language.into(),
            r#"
            (struct_specifier
                name: (type_identifier) @name
            ) @struct
            
            (union_specifier
                name: (type_identifier) @name
            ) @union
            
            (enum_specifier
                name: (type_identifier) @name
            ) @enum
            
            (type_definition
                declarator: (type_identifier) @name
            ) @typedef
            "#,
        ).map_err(|e| format!("Failed to create struct query: {}", e))?;

        // Include directives
        let include_query = Query::new(
            &language.into(),
            r#"
            (preproc_include
                path: [
                    (string_literal) @path
                    (system_lib_string) @system_path
                ]
            ) @include
            "#,
        ).map_err(|e| format!("Failed to create include query: {}", e))?;
        
        // Function calls
        let call_query = Query::new(
            &language.into(),
            r#"
            (call_expression
                function: [
                    (identifier) @callee
                    (field_expression
                        argument: (_) @receiver
                        field: (field_identifier) @callee
                    )
                    (parenthesized_expression
                        (pointer_expression
                            argument: (field_expression
                                argument: (_) @receiver
                                field: (field_identifier) @callee
                            )
                        )
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
            include_query,
            call_query,
        })
    }
    
    pub fn parse(&mut self, source: &str) -> ParseResult {
        let start = Instant::now();
        
        let tree = match self.parser.parse(source, None) {
            Some(t) => t,
            None => {
                let mut result = ParseResult::new(Language::C);
                result.errors.push(ParseError {
                    message: "Failed to parse source".to_string(),
                    range: Range::new(0, 0, 0, 0),
                });
                return result;
            }
        };
        
        let root = tree.root_node();
        let source_bytes = source.as_bytes();
        
        let mut result = ParseResult::with_tree(Language::C, tree.clone());
        
        self.extract_functions(&root, source_bytes, &mut result);
        self.extract_structs(&root, source_bytes, &mut result);
        self.extract_includes(&root, source_bytes, &mut result);
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
            let mut parameters = Vec::new();
            let mut return_type: Option<String> = None;
            let mut function_node: Option<Node> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.function_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
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
                    "function" | "ptr_function" => {
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
                    is_exported: true,
                    is_async: false,
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
                match child.kind() {
                    "parameter_declaration" => {
                        if let Some(param) = self.extract_single_parameter(&child, source) {
                            parameters.push(param);
                        }
                    }
                    "variadic_parameter" => {
                        // Handle ... (variadic)
                        parameters.push(ParameterInfo {
                            name: "...".to_string(),
                            type_annotation: Some("...".to_string()),
                            default_value: None,
                            is_rest: true,
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
        let mut type_parts = Vec::new();
        
        let mut cursor = param_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        // Last identifier is the name, previous ones are part of type
                        if !name.is_empty() {
                            type_parts.push(name.clone());
                        }
                        name = child.utf8_text(source).unwrap_or("").to_string();
                    }
                    "type_identifier" | "primitive_type" | "sized_type_specifier" => {
                        type_parts.push(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    "pointer_declarator" => {
                        // Handle pointer parameters like int *ptr
                        let mut ptr_cursor = child.walk();
                        if ptr_cursor.goto_first_child() {
                            loop {
                                let ptr_child = ptr_cursor.node();
                                if ptr_child.kind() == "identifier" {
                                    name = ptr_child.utf8_text(source).unwrap_or("").to_string();
                                }
                                if !ptr_cursor.goto_next_sibling() { break; }
                            }
                        }
                        type_parts.push("*".to_string());
                    }
                    "*" => {
                        type_parts.push("*".to_string());
                    }
                    "struct_specifier" | "union_specifier" | "enum_specifier" => {
                        type_parts.push(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    _ => {}
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        // Handle void parameters
        if name.is_empty() && type_parts.len() == 1 && type_parts[0] == "void" {
            return None;
        }
        
        // If we still don't have a name, try parsing the whole text
        if name.is_empty() {
            let text = param_node.utf8_text(source).unwrap_or("");
            // Try to extract name from "type name" pattern
            let parts: Vec<&str> = text.split_whitespace().collect();
            if parts.len() >= 2 {
                name = parts.last().unwrap_or(&"").trim_start_matches('*').to_string();
            }
        }
        
        if name.is_empty() {
            return None;
        }
        
        let type_annotation = if type_parts.is_empty() {
            None
        } else {
            Some(type_parts.join(" "))
        };
        
        Some(ParameterInfo {
            name,
            type_annotation,
            default_value: None,
            is_rest: false,
        })
    }
    
    /// Extract doc comment (/* */ or // comments before a function)
    fn extract_doc_comment(&self, node: &Node, source: &[u8]) -> Option<String> {
        let mut doc_lines = Vec::new();
        let mut sibling = node.prev_sibling();
        
        while let Some(sib) = sibling {
            if sib.kind() == "comment" {
                let comment = sib.utf8_text(source).unwrap_or("");
                if comment.starts_with("/*") && comment.ends_with("*/") {
                    // Block comment
                    let content = &comment[2..comment.len()-2];
                    let cleaned: Vec<&str> = content
                        .lines()
                        .map(|l| l.trim().trim_start_matches('*').trim())
                        .filter(|l| !l.is_empty())
                        .collect();
                    doc_lines.extend(cleaned.into_iter().map(|s| s.to_string()));
                } else if comment.starts_with("//") {
                    // Line comment
                    let content = comment.trim_start_matches("//").trim();
                    doc_lines.push(content.to_string());
                }
            } else {
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
            let mut struct_node: Option<Node> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.struct_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "struct" | "union" | "enum" | "typedef" => {
                        range = node_range(&node);
                        struct_node = Some(node);
                    }
                    _ => {}
                }
            }
            
            if !name.is_empty() {
                let properties = struct_node
                    .map(|n| self.extract_struct_fields(&n, source))
                    .unwrap_or_default();
                
                result.classes.push(ClassInfo {
                    name,
                    extends: None,
                    implements: Vec::new(),
                    is_exported: true,
                    is_abstract: false,
                    methods: Vec::new(),
                    properties,
                    range,
                    decorators: Vec::new(),
                });
            }
        }
    }
    
    /// Extract struct/union fields
    fn extract_struct_fields(&self, struct_node: &Node, source: &[u8]) -> Vec<PropertyInfo> {
        let mut properties = Vec::new();
        
        // Find the field_declaration_list inside the struct
        let mut cursor = struct_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "field_declaration_list" {
                    let mut field_cursor = child.walk();
                    if field_cursor.goto_first_child() {
                        loop {
                            let field = field_cursor.node();
                            if field.kind() == "field_declaration" {
                                if let Some(prop) = self.extract_field(&field, source) {
                                    properties.push(prop);
                                }
                            }
                            if !field_cursor.goto_next_sibling() { break; }
                        }
                    }
                    break;
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        
        properties
    }
    
    /// Extract a single struct field
    fn extract_field(&self, field_node: &Node, source: &[u8]) -> Option<PropertyInfo> {
        let mut name = String::new();
        let mut type_parts = Vec::new();
        
        let mut cursor = field_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "field_identifier" => {
                        name = child.utf8_text(source).unwrap_or("").to_string();
                    }
                    "type_identifier" | "primitive_type" | "sized_type_specifier" => {
                        type_parts.push(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    "pointer_declarator" => {
                        // Handle pointer fields
                        let mut ptr_cursor = child.walk();
                        if ptr_cursor.goto_first_child() {
                            loop {
                                let ptr_child = ptr_cursor.node();
                                if ptr_child.kind() == "field_identifier" {
                                    name = ptr_child.utf8_text(source).unwrap_or("").to_string();
                                }
                                if !ptr_cursor.goto_next_sibling() { break; }
                            }
                        }
                        type_parts.push("*".to_string());
                    }
                    "*" => {
                        type_parts.push("*".to_string());
                    }
                    "struct_specifier" | "union_specifier" | "enum_specifier" => {
                        type_parts.push(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    _ => {}
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        
        if name.is_empty() {
            return None;
        }
        
        let type_annotation = if type_parts.is_empty() {
            None
        } else {
            Some(type_parts.join(" "))
        };
        
        Some(PropertyInfo {
            name,
            type_annotation,
            is_static: false,
            is_readonly: false,
            visibility: Visibility::Public, // C doesn't have visibility modifiers
            tags: None,
        })
    }

    fn extract_includes(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.include_query, *root, source);
        
        for m in matches {
            let mut path = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.include_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "path" | "system_path" => {
                        let text = node.utf8_text(source).unwrap_or("");
                        path = text.trim_matches(|c| c == '"' || c == '<' || c == '>').to_string();
                    }
                    "include" => {
                        range = node_range(&node);
                    }
                    _ => {}
                }
            }
            
            if !path.is_empty() {
                result.imports.push(ImportInfo {
                    source: path,
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
}

impl Default for CParser {
    fn default() -> Self {
        Self::new().expect("Failed to create C parser")
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
        let mut parser = CParser::new().unwrap();
        let result = parser.parse("int main(void) { return 0; }");
        
        assert_eq!(result.functions.len(), 1);
        assert_eq!(result.functions[0].name, "main");
    }

    #[test]
    fn test_parse_static_function() {
        let mut parser = CParser::new().unwrap();
        let result = parser.parse("static void init_hardware(void) { }");
        
        assert_eq!(result.functions.len(), 1);
        assert_eq!(result.functions[0].name, "init_hardware");
    }

    #[test]
    fn test_parse_struct() {
        let mut parser = CParser::new().unwrap();
        let result = parser.parse("struct gpio_config { int pin; int mode; };");
        
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "gpio_config");
    }

    #[test]
    fn test_parse_typedef_struct() {
        let mut parser = CParser::new().unwrap();
        let result = parser.parse("typedef struct { int x; int y; } Point;");
        
        assert!(result.classes.len() >= 1);
    }

    #[test]
    fn test_parse_include() {
        let mut parser = CParser::new().unwrap();
        let result = parser.parse("#include <stdio.h>\n#include \"myheader.h\"");
        
        assert_eq!(result.imports.len(), 2);
        assert_eq!(result.imports[0].source, "stdio.h");
        assert_eq!(result.imports[1].source, "myheader.h");
    }

    #[test]
    fn test_parse_function_call() {
        let mut parser = CParser::new().unwrap();
        let result = parser.parse("void test() { printf(\"hello\"); }");
        
        assert!(result.calls.len() >= 1);
        let call = result.calls.iter().find(|c| c.callee == "printf").unwrap();
        assert_eq!(call.callee, "printf");
    }

    #[test]
    fn test_parse_struct_field_call() {
        let mut parser = CParser::new().unwrap();
        let result = parser.parse("void test() { device->init(); }");
        
        assert!(result.calls.len() >= 1);
        let call = result.calls.iter().find(|c| c.callee == "init").unwrap();
        assert_eq!(call.receiver, Some("device".to_string()));
    }

    #[test]
    fn test_parse_embedded_patterns() {
        let mut parser = CParser::new().unwrap();
        let source = r#"
            #include "stm32f4xx.h"
            
            typedef struct {
                uint32_t pin;
                uint32_t mode;
            } GPIO_Config;
            
            static void GPIO_Init(GPIO_Config* config) {
                HAL_GPIO_Init(GPIOA, config);
            }
            
            int main(void) {
                GPIO_Config led = {.pin = 5, .mode = OUTPUT};
                GPIO_Init(&led);
                while(1) {
                    HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
                    HAL_Delay(500);
                }
                return 0;
            }
        "#;
        
        let result = parser.parse(source);
        
        // Should find functions
        assert!(result.functions.len() >= 2);
        assert!(result.functions.iter().any(|f| f.name == "GPIO_Init"));
        assert!(result.functions.iter().any(|f| f.name == "main"));
        
        // Should find struct/typedef
        assert!(result.classes.len() >= 1);
        
        // Should find includes
        assert!(result.imports.len() >= 1);
        
        // Should find HAL calls
        assert!(result.calls.iter().any(|c| c.callee == "HAL_GPIO_Init"));
        assert!(result.calls.iter().any(|c| c.callee == "HAL_Delay"));
    }
    
    // ==================== NEW ENTERPRISE FEATURE TESTS ====================
    
    #[test]
    fn test_parse_function_parameters() {
        let mut parser = CParser::new().unwrap();
        let source = r#"
            int add(int a, int b, int c) {
                return a + b + c;
            }
        "#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "add").unwrap();
        assert!(func.parameters.len() >= 3, "Expected 3 parameters, got: {:?}", func.parameters);
    }
    
    #[test]
    fn test_parse_pointer_parameters() {
        let mut parser = CParser::new().unwrap();
        let source = r#"
            void process(char *buffer, size_t len) {
            }
        "#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "process").unwrap();
        assert!(func.parameters.len() >= 1, "Expected parameters");
    }
    
    #[test]
    fn test_parse_struct_fields() {
        let mut parser = CParser::new().unwrap();
        let source = r#"
            struct Point {
                int x;
                int y;
                float z;
            };
        "#;
        let result = parser.parse(source);
        
        let point = result.classes.iter().find(|c| c.name == "Point").unwrap();
        assert!(point.properties.len() >= 3, "Expected 3 fields, got: {:?}", point.properties);
        
        assert!(point.properties.iter().any(|p| p.name == "x"));
        assert!(point.properties.iter().any(|p| p.name == "y"));
        assert!(point.properties.iter().any(|p| p.name == "z"));
    }
    
    #[test]
    fn test_parse_doc_comment() {
        let mut parser = CParser::new().unwrap();
        let source = r#"
            /*
             * Initialize the hardware
             * @param config Configuration struct
             */
            void init_hardware(Config* config) {
            }
        "#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "init_hardware").unwrap();
        assert!(func.doc_comment.is_some(), "Expected doc comment");
        let doc = func.doc_comment.as_ref().unwrap();
        assert!(doc.contains("Initialize"), "Doc should contain description: {}", doc);
    }
    
    #[test]
    fn test_parse_variadic_function() {
        let mut parser = CParser::new().unwrap();
        let source = r#"
            int printf(const char *format, ...) {
                return 0;
            }
        "#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "printf").unwrap();
        assert!(func.parameters.len() >= 1, "Expected at least 1 parameter");
    }
}
