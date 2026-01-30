//! PHP parser using native tree-sitter
//!
//! Extracts functions, classes, imports, and call sites from PHP code.
//! Supports Laravel, Symfony, and other framework patterns.
//!
//! Enterprise features:
//! - PHP 8 attribute extraction (#[Route], #[IsGranted], etc.)
//! - extends extraction for classes
//! - implements extraction for interfaces
//! - Parameter extraction with types
//! - Return type extraction
//! - Doc comment extraction (PHPDoc)
//! - Visibility modifiers (public, private, protected)
//! - Abstract class detection

use std::time::Instant;
use tree_sitter::{Node, Parser, Query, QueryCursor};

use super::types::*;

pub struct PhpParser {
    parser: Parser,
    function_query: Query,
    class_query: Query,
    use_query: Query,
    call_query: Query,
}

impl PhpParser {
    pub fn new() -> Result<Self, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_php::LANGUAGE_PHP;
        parser.set_language(&language.into()).map_err(|e| format!("Failed to set language: {}", e))?;
        
        let function_query = Query::new(&language.into(), r#"
            (function_definition name: (name) @name parameters: (formal_parameters) @params return_type: (_)? @return_type) @function
            (method_declaration (attribute_list)? @method_attrs (visibility_modifier)? @visibility name: (name) @name parameters: (formal_parameters) @params return_type: (_)? @return_type) @method
        "#).map_err(|e| format!("Failed to create function query: {}", e))?;

        let class_query = Query::new(&language.into(), r#"
            (class_declaration (attribute_list)? @attributes (abstract_modifier)? @abstract name: (name) @name (base_clause (name) @extends)? (class_interface_clause (name) @implements)*) @class
            (interface_declaration name: (name) @name (base_clause (name) @extends_interface)*) @interface
            (trait_declaration name: (name) @name) @trait
        "#).map_err(|e| format!("Failed to create class query: {}", e))?;
        
        let use_query = Query::new(&language.into(), r#"
            (namespace_use_declaration (namespace_use_clause (qualified_name) @namespace)) @use
        "#).map_err(|e| format!("Failed to create use query: {}", e))?;

        let call_query = Query::new(&language.into(), r#"
            (function_call_expression function: [(name) @callee (qualified_name) @callee] arguments: (arguments) @args) @call
            (member_call_expression object: (_) @receiver name: (name) @callee arguments: (arguments) @args) @method_call
            (scoped_call_expression scope: (_) @receiver name: (name) @callee arguments: (arguments) @args) @static_call
        "#).map_err(|e| format!("Failed to create call query: {}", e))?;
        
        Ok(Self { parser, function_query, class_query, use_query, call_query })
    }

    pub fn parse(&mut self, source: &str) -> ParseResult {
        let start = Instant::now();
        let tree = match self.parser.parse(source, None) {
            Some(t) => t,
            None => {
                let mut result = ParseResult::new(Language::Php);
                result.errors.push(ParseError { message: "Failed to parse source".to_string(), range: Range::new(0, 0, 0, 0) });
                return result;
            }
        };
        let root = tree.root_node();
        let source_bytes = source.as_bytes();
        let mut result = ParseResult::with_tree(Language::Php, tree.clone());
        self.extract_functions(&root, source_bytes, &mut result);
        self.extract_classes(&root, source_bytes, &mut result);
        self.extract_uses(&root, source_bytes, &mut result);
        self.extract_calls(&root, source_bytes, &mut result);
        result.parse_time_us = start.elapsed().as_micros() as u64;
        result
    }
    
    fn extract_attributes(&self, attr_node: &Node, source: &[u8]) -> Vec<String> {
        let mut attributes = Vec::new();
        let mut cursor = attr_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "attribute_group" {
                    let mut group_cursor = child.walk();
                    if group_cursor.goto_first_child() {
                        loop {
                            let attr = group_cursor.node();
                            if attr.kind() == "attribute" {
                                if let Ok(text) = attr.utf8_text(source) {
                                    if !text.is_empty() { attributes.push(format!("#[{}]", text)); }
                                }
                            }
                            if !group_cursor.goto_next_sibling() { break; }
                        }
                    }
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        attributes
    }

    fn extract_parameters(&self, params_node: &Node, source: &[u8]) -> Vec<ParameterInfo> {
        let mut parameters = Vec::new();
        let mut cursor = params_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if matches!(child.kind(), "simple_parameter" | "variadic_parameter" | "property_promotion_parameter") {
                    if let Some(param) = self.extract_single_parameter(&child, source) { parameters.push(param); }
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        parameters
    }

    fn extract_single_parameter(&self, param_node: &Node, source: &[u8]) -> Option<ParameterInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut default_value = None;
        let is_rest = param_node.kind() == "variadic_parameter";
        let mut cursor = param_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "variable_name" => { 
                        let text = child.utf8_text(source).unwrap_or("");
                        name = text.trim_start_matches('$').to_string(); 
                    }
                    "type_list" | "named_type" | "optional_type" | "union_type" | "intersection_type" | "primitive_type" => {
                        type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    _ => {
                        if child.kind().contains("expression") || matches!(child.kind(), "string" | "integer" | "float" | "boolean" | "null") {
                            default_value = Some(child.utf8_text(source).unwrap_or("").to_string());
                        }
                    }
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        if name.is_empty() { return None; }
        Some(ParameterInfo { name, type_annotation, default_value, is_rest })
    }

    fn extract_doc_comment(&self, node: &Node, source: &[u8]) -> Option<String> {
        if let Some(prev) = node.prev_sibling() {
            if prev.kind() == "comment" {
                let comment = prev.utf8_text(source).unwrap_or("");
                if comment.starts_with("/**") { return Some(self.clean_phpdoc(comment)); }
            }
        }
        None
    }

    fn clean_phpdoc(&self, doc: &str) -> String {
        let doc = doc.trim();
        let doc = if doc.starts_with("/**") && doc.ends_with("*/") { &doc[3..doc.len()-2] } else { doc };
        doc.lines().map(|l| { let t = l.trim(); if t.starts_with('*') { t[1..].trim() } else { t } }).filter(|l| !l.is_empty()).collect::<Vec<_>>().join("\n")
    }

    fn extract_functions(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        for m in cursor.matches(&self.function_query, *root, source) {
            let mut name = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_public = true;
            let mut return_type: Option<String> = None;
            let mut parameters = Vec::new();
            let mut decorators = Vec::new();
            let mut method_node: Option<Node> = None;
            
            for capture in m.captures {
                let node = capture.node;
                match self.function_query.capture_names()[capture.index as usize] {
                    "name" => { name = node.utf8_text(source).unwrap_or("").to_string(); }
                    "visibility" => { is_public = node.utf8_text(source).unwrap_or("") == "public"; }
                    "return_type" => { let rt = node.utf8_text(source).unwrap_or("").trim_start_matches(':').trim(); if !rt.is_empty() { return_type = Some(rt.to_string()); } }
                    "params" => { parameters = self.extract_parameters(&node, source); }
                    "method_attrs" => { decorators = self.extract_attributes(&node, source); }
                    "function" | "method" => { range = node_range(&node); method_node = Some(node); }
                    _ => {}
                }
            }
            if !name.is_empty() {
                let doc_comment = method_node.as_ref().and_then(|n| self.extract_doc_comment(n, source));
                result.functions.push(FunctionInfo { name, qualified_name: None, parameters, return_type, is_exported: is_public, is_async: false, is_generator: false, range, decorators, doc_comment });
            }
        }
    }

    fn extract_classes(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        for m in cursor.matches(&self.class_query, *root, source) {
            let mut name = String::new();
            let mut extends = None;
            let mut implements = Vec::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_abstract = false;
            let mut attributes = Vec::new();
            
            for capture in m.captures {
                let node = capture.node;
                match self.class_query.capture_names()[capture.index as usize] {
                    "name" => { name = node.utf8_text(source).unwrap_or("").to_string(); }
                    "extends" => { extends = Some(node.utf8_text(source).unwrap_or("").to_string()); }
                    "implements" | "extends_interface" => { let n = node.utf8_text(source).unwrap_or("").to_string(); if !n.is_empty() { implements.push(n); } }
                    "abstract" => { is_abstract = true; }
                    "attributes" => { attributes = self.extract_attributes(&node, source); }
                    "class" => { range = node_range(&node); }
                    "interface" => { range = node_range(&node); is_abstract = true; }
                    "trait" => { range = node_range(&node); }
                    _ => {}
                }
            }
            if !name.is_empty() {
                result.classes.push(ClassInfo { name, extends, implements, is_exported: true, is_abstract, methods: Vec::new(), properties: Vec::new(), range, decorators: attributes });
            }
        }
    }
    
    fn extract_uses(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        for m in cursor.matches(&self.use_query, *root, source) {
            let mut namespace = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            for capture in m.captures {
                let node = capture.node;
                match self.use_query.capture_names()[capture.index as usize] {
                    "namespace" => { namespace = node.utf8_text(source).unwrap_or("").to_string(); }
                    "use" => { range = node_range(&node); }
                    _ => {}
                }
            }
            if !namespace.is_empty() {
                let class_name = namespace.rsplit('\\').next().unwrap_or(&namespace).to_string();
                result.imports.push(ImportInfo { source: namespace, named: vec![class_name], default: None, namespace: None, is_type_only: false, range });
            }
        }
    }

    fn extract_calls(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        for m in cursor.matches(&self.call_query, *root, source) {
            let mut callee = String::new();
            let mut receiver = None;
            let mut arg_count = 0;
            let mut range = Range::new(0, 0, 0, 0);
            for capture in m.captures {
                let node = capture.node;
                match self.call_query.capture_names()[capture.index as usize] {
                    "callee" => { callee = node.utf8_text(source).unwrap_or("").to_string(); }
                    "receiver" => { 
                        let text = node.utf8_text(source).unwrap_or("");
                        receiver = Some(text.trim_start_matches('$').to_string()); 
                    }
                    "args" => { arg_count = node.named_child_count(); }
                    "call" | "method_call" | "static_call" => { range = node_range(&node); }
                    _ => {}
                }
            }
            if !callee.is_empty() { result.calls.push(CallSite { callee, receiver, arg_count, range }); }
        }
    }
}

impl Default for PhpParser { fn default() -> Self { Self::new().expect("Failed to create PHP parser") } }

fn node_range(node: &Node) -> Range {
    Range { start: Position { line: node.start_position().row as u32, column: node.start_position().column as u32 }, end: Position { line: node.end_position().row as u32, column: node.end_position().column as u32 } }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_class() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse("<?php class UserController { }");
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "UserController");
    }

    #[test]
    fn test_parse_function() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse("<?php function hello() { }");
        assert_eq!(result.functions.len(), 1);
        assert_eq!(result.functions[0].name, "hello");
    }

    #[test]
    fn test_parse_method_call_with_receiver() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse(r#"<?php $user->save();"#);
        let call = result.calls.iter().find(|c| c.callee == "save").unwrap();
        assert_eq!(call.receiver, Some("user".to_string()));
    }

    #[test]
    fn test_parse_static_call_with_receiver() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse("<?php User::find(1);");
        let call = result.calls.iter().find(|c| c.callee == "find").unwrap();
        assert_eq!(call.receiver, Some("User".to_string()));
    }

    #[test]
    fn test_parse_class_extends() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse("<?php class UserController extends Controller { }");
        assert_eq!(result.classes[0].extends, Some("Controller".to_string()));
    }

    #[test]
    fn test_parse_class_implements() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse("<?php class UserService implements UserServiceInterface { }");
        assert!(result.classes[0].implements.contains(&"UserServiceInterface".to_string()));
    }

    #[test]
    fn test_parse_class_extends_and_implements() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse("<?php class OrderController extends Controller implements Loggable { }");
        assert_eq!(result.classes[0].extends, Some("Controller".to_string()));
        assert!(result.classes[0].implements.contains(&"Loggable".to_string()));
    }

    #[test]
    fn test_parse_abstract_class() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse("<?php abstract class BaseRepository { }");
        assert!(result.classes[0].is_abstract);
    }

    #[test]
    fn test_parse_method_parameters_with_types() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse(r#"<?php class X { public function find(int $id, string $name): void {} }"#);
        let method = result.functions.iter().find(|f| f.name == "find").unwrap();
        assert_eq!(method.parameters.len(), 2);
        assert_eq!(method.parameters[0].type_annotation, Some("int".to_string()));
        assert_eq!(method.parameters[1].type_annotation, Some("string".to_string()));
    }

    #[test]
    fn test_parse_return_type() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse("<?php class X { public function findAll(): array { return []; } }");
        let method = result.functions.iter().find(|f| f.name == "findAll").unwrap();
        assert_eq!(method.return_type, Some("array".to_string()));
    }

    #[test]
    fn test_parse_php8_attributes_on_class() {
        let mut parser = PhpParser::new().unwrap();
        let result = parser.parse("<?php\n#[Entity]\n#[Table(name: 'users')]\nclass User { }");
        assert!(result.classes[0].decorators.iter().any(|d| d.contains("Entity")));
        assert!(result.classes[0].decorators.iter().any(|d| d.contains("Table")));
    }

    #[test]
    fn test_parse_php8_route_attributes() {
        let mut parser = PhpParser::new().unwrap();
        let source = "<?php\nclass X {\n    #[Route('/users')]\n    #[IsGranted('ROLE_USER')]\n    public function show(): void {}\n}";
        let result = parser.parse(source);
        let method = result.functions.iter().find(|f| f.name == "show").unwrap();
        assert!(method.decorators.iter().any(|d| d.contains("Route")), "Expected Route, got: {:?}", method.decorators);
        assert!(method.decorators.iter().any(|d| d.contains("IsGranted")), "Expected IsGranted, got: {:?}", method.decorators);
    }
}
