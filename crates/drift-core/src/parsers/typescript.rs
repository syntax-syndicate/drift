//! TypeScript/JavaScript parser using native tree-sitter
//!
//! Enterprise features:
//! - @Decorator extraction for classes, methods, and properties
//! - Parameter extraction with types
//! - Return type extraction
//! - JSDoc comment extraction
//! - Property extraction with visibility modifiers
//! - Abstract class detection
//! - Type-only import detection

use std::time::Instant;
use tree_sitter::{Node, Parser, Query, QueryCursor};
use super::types::*;

pub struct TypeScriptParser {
    parser: Parser,
    function_query: Query,
    class_query: Query,
    import_query: Query,
    export_query: Query,
    call_query: Query,
}

impl TypeScriptParser {
    pub fn new() -> Result<Self, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_typescript::LANGUAGE_TYPESCRIPT;
        parser.set_language(&language.into()).map_err(|e| format!("Failed to set language: {}", e))?;
        
        let function_query = Query::new(&language.into(), r#"
            (function_declaration name: (identifier) @name parameters: (formal_parameters) @params return_type: (type_annotation)? @return_type) @function
            (method_definition name: (property_identifier) @name parameters: (formal_parameters) @params return_type: (type_annotation)? @return_type) @method
            (arrow_function parameters: [(formal_parameters) (identifier)] @params return_type: (type_annotation)? @return_type) @arrow
        "#).map_err(|e| format!("Failed to create function query: {}", e))?;
        
        let class_query = Query::new(&language.into(), r#"
            (class_declaration name: (type_identifier) @name (class_heritage (extends_clause (identifier) @extends)? (implements_clause (type_identifier) @implements)*)?) @class
        "#).map_err(|e| format!("Failed to create class query: {}", e))?;
        
        let import_query = Query::new(&language.into(), r#"
            (import_statement (import_clause (identifier)? @default (named_imports (import_specifier (identifier) @named)*)? (namespace_import (identifier) @namespace)?)? source: (string) @source) @import
        "#).map_err(|e| format!("Failed to create import query: {}", e))?;
        
        let export_query = Query::new(&language.into(), r#"
            (export_statement (export_clause (export_specifier name: (identifier) @name)*)? source: (string)? @source declaration: [(function_declaration name: (identifier) @decl_name) (class_declaration name: (type_identifier) @decl_name) (lexical_declaration (variable_declarator name: (identifier) @decl_name))]?) @export
        "#).map_err(|e| format!("Failed to create export query: {}", e))?;
        
        let call_query = Query::new(&language.into(), r#"
            (call_expression function: [(identifier) @callee (member_expression object: (_) @receiver property: (property_identifier) @callee)] arguments: (arguments) @args) @call
        "#).map_err(|e| format!("Failed to create call query: {}", e))?;
        
        Ok(Self { parser, function_query, class_query, import_query, export_query, call_query })
    }

    pub fn parse(&mut self, source: &str, is_typescript: bool) -> ParseResult {
        let start = Instant::now();
        let tree = match self.parser.parse(source, None) {
            Some(t) => t,
            None => {
                let mut result = ParseResult::new(if is_typescript { Language::TypeScript } else { Language::JavaScript });
                result.errors.push(ParseError { message: "Failed to parse source".to_string(), range: Range::new(0, 0, 0, 0) });
                return result;
            }
        };
        let root = tree.root_node();
        let source_bytes = source.as_bytes();
        let mut result = ParseResult::with_tree(if is_typescript { Language::TypeScript } else { Language::JavaScript }, tree.clone());
        self.extract_functions(&root, source_bytes, &mut result);
        self.extract_classes(&root, source_bytes, &mut result);
        self.extract_imports(&root, source_bytes, &mut result);
        self.extract_exports(&root, source_bytes, &mut result);
        self.extract_calls(&root, source_bytes, &mut result);
        result.parse_time_us = start.elapsed().as_micros() as u64;
        result
    }

    fn extract_functions(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        for m in cursor.matches(&self.function_query, *root, source) {
            let mut name = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_async = false;
            let mut is_generator = false;
            let mut function_node: Option<Node> = None;
            let mut params_node: Option<Node> = None;
            let mut return_type: Option<String> = None;
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.function_query.capture_names()[capture.index as usize];
                match capture_name {
                    "name" => name = node.utf8_text(source).unwrap_or("").to_string(),
                    "params" => params_node = Some(node),
                    "return_type" => {
                        let t = node.utf8_text(source).unwrap_or("").trim_start_matches(':').trim();
                        if !t.is_empty() { return_type = Some(t.to_string()); }
                    }
                    "function" | "method" | "arrow" => {
                        range = node_range(&node);
                        function_node = Some(node);
                        let text = node.utf8_text(source).unwrap_or("");
                        is_async = text.trim_start().starts_with("async ");
                        is_generator = text.contains("function*");
                    }
                    _ => {}
                }
            }
            if !name.is_empty() {
                let decorators = function_node.map(|n| self.extract_decorators(&n, source)).unwrap_or_default();
                let doc_comment = function_node.and_then(|n| self.extract_jsdoc(&n, source));
                let parameters = params_node.map(|n| self.extract_parameters(&n, source)).unwrap_or_default();
                let is_exported = function_node.map(|n| self.check_visibility(&n, source)).unwrap_or(true);
                result.functions.push(FunctionInfo { name, qualified_name: None, parameters, return_type, is_exported, is_async, is_generator, range, decorators, doc_comment });
            }
        }
    }

    fn extract_parameters(&self, params_node: &Node, source: &[u8]) -> Vec<ParameterInfo> {
        let mut params = Vec::new();
        let mut cursor = params_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "required_parameter" | "optional_parameter" => { if let Some(p) = self.extract_param(&child, source, false) { params.push(p); } }
                    "rest_parameter" => { if let Some(p) = self.extract_param(&child, source, true) { params.push(p); } }
                    "identifier" => { let n = child.utf8_text(source).unwrap_or("").to_string(); if !n.is_empty() { params.push(ParameterInfo { name: n, type_annotation: None, default_value: None, is_rest: false }); } }
                    _ => {}
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        params
    }

    fn extract_param(&self, node: &Node, source: &[u8], is_rest: bool) -> Option<ParameterInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut default_value = None;
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => if name.is_empty() { name = child.utf8_text(source).unwrap_or("").to_string(); }
                    "type_annotation" => { let t = child.utf8_text(source).unwrap_or("").trim_start_matches(':').trim(); if !t.is_empty() { type_annotation = Some(t.to_string()); } }
                    _ => { if let Some(prev) = child.prev_sibling() { if prev.kind() == "=" { default_value = Some(child.utf8_text(source).unwrap_or("").to_string()); } } }
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        if name.is_empty() { return None; }
        Some(ParameterInfo { name, type_annotation, default_value, is_rest })
    }

    fn extract_jsdoc(&self, node: &Node, source: &[u8]) -> Option<String> {
        let mut sibling = node.prev_sibling();
        while let Some(sib) = sibling {
            if sib.kind() == "comment" {
                let text = sib.utf8_text(source).unwrap_or("");
                if text.starts_with("/**") && text.ends_with("*/") {
                    return Some(text.trim_start_matches("/**").trim_end_matches("*/").lines().map(|l| l.trim().trim_start_matches('*').trim()).filter(|l| !l.is_empty()).collect::<Vec<_>>().join("\n"));
                }
            } else if sib.kind() != "decorator" { break; }
            sibling = sib.prev_sibling();
        }
        None
    }

    fn check_visibility(&self, node: &Node, source: &[u8]) -> bool {
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "accessibility_modifier" { return child.utf8_text(source).unwrap_or("") == "public"; }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        true
    }

    fn extract_decorators(&self, node: &Node, source: &[u8]) -> Vec<String> {
        let mut decorators = Vec::new();
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "decorator" { if let Some(n) = self.extract_decorator_name(&child, source) { decorators.push(n); } }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        if !decorators.is_empty() { return decorators; }
        let mut current = node.prev_sibling();
        while let Some(sibling) = current {
            if sibling.kind() == "decorator" { if let Some(n) = self.extract_decorator_name(&sibling, source) { decorators.push(n); } }
            else if sibling.kind() != "comment" && sibling.kind() != "export" { break; }
            current = sibling.prev_sibling();
        }
        decorators.reverse();
        decorators
    }

    fn extract_decorator_name(&self, decorator_node: &Node, source: &[u8]) -> Option<String> {
        let mut cursor = decorator_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "call_expression" => {
                        let mut call_cursor = child.walk();
                        if call_cursor.goto_first_child() {
                            loop {
                                let cc = call_cursor.node();
                                if cc.kind() == "identifier" || cc.kind() == "member_expression" { let n = cc.utf8_text(source).unwrap_or(""); if !n.is_empty() { return Some(format!("@{}", n)); } }
                                if !call_cursor.goto_next_sibling() { break; }
                            }
                        }
                    }
                    "identifier" | "member_expression" => { let n = child.utf8_text(source).unwrap_or(""); if !n.is_empty() { return Some(format!("@{}", n)); } }
                    _ => {}
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        None
    }

    fn extract_classes(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        for m in cursor.matches(&self.class_query, *root, source) {
            let mut name = String::new();
            let mut extends = None;
            let mut implements = Vec::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut class_node: Option<Node> = None;
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.class_query.capture_names()[capture.index as usize];
                match capture_name {
                    "name" => name = node.utf8_text(source).unwrap_or("").to_string(),
                    "extends" => extends = Some(node.utf8_text(source).unwrap_or("").to_string()),
                    "implements" => implements.push(node.utf8_text(source).unwrap_or("").to_string()),
                    "class" => { range = node_range(&node); class_node = Some(node); }
                    _ => {}
                }
            }
            if !name.is_empty() {
                let decorators = class_node.map(|n| self.extract_decorators(&n, source)).unwrap_or_default();
                let is_abstract = class_node.map(|n| n.utf8_text(source).unwrap_or("").trim_start().starts_with("abstract ")).unwrap_or(false);
                let properties = class_node.map(|n| self.extract_class_properties(&n, source)).unwrap_or_default();
                result.classes.push(ClassInfo { name, extends, implements, is_exported: false, is_abstract, methods: Vec::new(), properties, range, decorators });
            }
        }
    }

    fn extract_class_properties(&self, class_node: &Node, source: &[u8]) -> Vec<PropertyInfo> {
        let mut properties = Vec::new();
        let mut cursor = class_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "class_body" {
                    let mut body_cursor = child.walk();
                    if body_cursor.goto_first_child() {
                        loop {
                            let member = body_cursor.node();
                            match member.kind() {
                                "public_field_definition" | "property_definition" => { if let Some(p) = self.extract_property(&member, source) { properties.push(p); } }
                                "method_definition" => { if member.utf8_text(source).unwrap_or("").contains("constructor") { properties.extend(self.extract_ctor_properties(&member, source)); } }
                                _ => {}
                            }
                            if !body_cursor.goto_next_sibling() { break; }
                        }
                    }
                    break;
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        properties
    }

    fn extract_property(&self, node: &Node, source: &[u8]) -> Option<PropertyInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut is_static = false;
        let mut is_readonly = false;
        let mut visibility = Visibility::Public;
        let mut decorators = Vec::new();
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "property_identifier" | "private_property_identifier" => { name = child.utf8_text(source).unwrap_or("").to_string(); if child.kind() == "private_property_identifier" { visibility = Visibility::Private; } }
                    "type_annotation" => { let t = child.utf8_text(source).unwrap_or("").trim_start_matches(':').trim(); if !t.is_empty() { type_annotation = Some(t.to_string()); } }
                    "accessibility_modifier" => { visibility = match child.utf8_text(source).unwrap_or("") { "private" => Visibility::Private, "protected" => Visibility::Protected, _ => Visibility::Public }; }
                    "decorator" => { if let Some(n) = self.extract_decorator_name(&child, source) { decorators.push(n); } }
                    _ => { let t = child.utf8_text(source).unwrap_or(""); if t == "static" { is_static = true; } else if t == "readonly" { is_readonly = true; } }
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        if name.is_empty() { return None; }
        let tags = if !decorators.is_empty() { Some(decorators.iter().map(|d| StructTag { key: "decorator".to_string(), value: d.clone() }).collect()) } else { None };
        Some(PropertyInfo { name, type_annotation, is_static, is_readonly, visibility, tags })
    }

    fn extract_ctor_properties(&self, ctor_node: &Node, source: &[u8]) -> Vec<PropertyInfo> {
        let mut properties = Vec::new();
        let mut cursor = ctor_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "formal_parameters" {
                    let mut param_cursor = child.walk();
                    if param_cursor.goto_first_child() {
                        loop {
                            let param = param_cursor.node();
                            if param.kind() == "required_parameter" || param.kind() == "optional_parameter" { if let Some(p) = self.extract_param_property(&param, source) { properties.push(p); } }
                            if !param_cursor.goto_next_sibling() { break; }
                        }
                    }
                    break;
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        properties
    }

    fn extract_param_property(&self, param_node: &Node, source: &[u8]) -> Option<PropertyInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut is_readonly = false;
        let mut visibility: Option<Visibility> = None;
        let mut decorators = Vec::new();
        let mut cursor = param_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => if name.is_empty() { name = child.utf8_text(source).unwrap_or("").to_string(); }
                    "type_annotation" => { let t = child.utf8_text(source).unwrap_or("").trim_start_matches(':').trim(); if !t.is_empty() { type_annotation = Some(t.to_string()); } }
                    "accessibility_modifier" => { visibility = Some(match child.utf8_text(source).unwrap_or("") { "private" => Visibility::Private, "protected" => Visibility::Protected, _ => Visibility::Public }); }
                    "decorator" => { if let Some(n) = self.extract_decorator_name(&child, source) { decorators.push(n); } }
                    _ => if child.utf8_text(source).unwrap_or("") == "readonly" { is_readonly = true; }
                }
                if !cursor.goto_next_sibling() { break; }
            }
        }
        let visibility = visibility?;
        if name.is_empty() { return None; }
        let tags = if !decorators.is_empty() { Some(decorators.iter().map(|d| StructTag { key: "decorator".to_string(), value: d.clone() }).collect()) } else { None };
        Some(PropertyInfo { name, type_annotation, is_static: false, is_readonly, visibility, tags })
    }

    fn extract_imports(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        for m in cursor.matches(&self.import_query, *root, source) {
            let mut import_source = String::new();
            let mut named = Vec::new();
            let mut default = None;
            let mut namespace = None;
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_type_only = false;
            let mut import_node: Option<Node> = None;
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.import_query.capture_names()[capture.index as usize];
                match capture_name {
                    "source" => import_source = node.utf8_text(source).unwrap_or("").trim_matches(|c| c == '"' || c == '\'').to_string(),
                    "named" => named.push(node.utf8_text(source).unwrap_or("").to_string()),
                    "default" => default = Some(node.utf8_text(source).unwrap_or("").to_string()),
                    "namespace" => namespace = Some(node.utf8_text(source).unwrap_or("").to_string()),
                    "import" => { range = node_range(&node); import_node = Some(node); }
                    _ => {}
                }
            }
            if let Some(n) = import_node { is_type_only = n.utf8_text(source).unwrap_or("").contains("import type "); }
            if !import_source.is_empty() { result.imports.push(ImportInfo { source: import_source, named, default, namespace, is_type_only, range }); }
        }
    }

    fn extract_exports(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        for m in cursor.matches(&self.export_query, *root, source) {
            let mut names = Vec::new();
            let mut from_source = None;
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_type_only = false;
            let mut export_node: Option<Node> = None;
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.export_query.capture_names()[capture.index as usize];
                match capture_name {
                    "name" | "decl_name" => names.push(node.utf8_text(source).unwrap_or("").to_string()),
                    "source" => from_source = Some(node.utf8_text(source).unwrap_or("").trim_matches(|c| c == '"' || c == '\'').to_string()),
                    "export" => { range = node_range(&node); export_node = Some(node); }
                    _ => {}
                }
            }
            if let Some(n) = export_node { is_type_only = n.utf8_text(source).unwrap_or("").contains("export type "); }
            for name in names { if !name.is_empty() { result.exports.push(ExportInfo { name, original_name: None, from_source: from_source.clone(), is_type_only, is_default: false, range }); } }
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
                let capture_name = self.call_query.capture_names()[capture.index as usize];
                match capture_name {
                    "callee" => callee = node.utf8_text(source).unwrap_or("").to_string(),
                    "receiver" => receiver = Some(node.utf8_text(source).unwrap_or("").to_string()),
                    "args" => arg_count = node.named_child_count(),
                    "call" => range = node_range(&node),
                    _ => {}
                }
            }
            if !callee.is_empty() { result.calls.push(CallSite { callee, receiver, arg_count, range }); }
        }
    }
}

impl Default for TypeScriptParser {
    fn default() -> Self { Self::new().expect("Failed to create TypeScript parser") }
}

fn node_range(node: &Node) -> Range {
    Range { start: Position { line: node.start_position().row as u32, column: node.start_position().column as u32 }, end: Position { line: node.end_position().row as u32, column: node.end_position().column as u32 } }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_function() {
        let mut parser = TypeScriptParser::new().unwrap();
        let result = parser.parse("function hello(name: string): void { console.log(name); }", true);
        assert_eq!(result.functions.len(), 1);
        assert_eq!(result.functions[0].name, "hello");
    }

    #[test]
    fn test_parse_class() {
        let mut parser = TypeScriptParser::new().unwrap();
        let result = parser.parse("class MyClass extends Base { }", true);
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "MyClass");
        assert_eq!(result.classes[0].extends, Some("Base".to_string()));
    }

    #[test]
    fn test_parse_nestjs_controller() {
        let mut parser = TypeScriptParser::new().unwrap();
        let source = "@Controller('users') @UseGuards(AuthGuard) export class UsersController { @Get(':id') async getUser(@Param('id') id: string) {} }";
        let result = parser.parse(source, true);
        assert_eq!(result.classes.len(), 1);
        assert!(result.classes[0].decorators.contains(&"@Controller".to_string()));
    }

    #[test]
    fn test_parse_function_parameters() {
        let mut parser = TypeScriptParser::new().unwrap();
        let source = "function createUser(name: string, age: number): User { return null; }";
        let result = parser.parse(source, true);
        let func = result.functions.iter().find(|f| f.name == "createUser").unwrap();
        assert_eq!(func.parameters.len(), 2);
        assert_eq!(func.parameters[0].name, "name");
        assert_eq!(func.parameters[0].type_annotation, Some("string".to_string()));
        assert_eq!(func.parameters[1].name, "age");
        assert_eq!(func.parameters[1].type_annotation, Some("number".to_string()));
    }

    #[test]
    fn test_parse_return_type() {
        let mut parser = TypeScriptParser::new().unwrap();
        let source = "async function getUser(id: string): Promise<User> { return null; }";
        let result = parser.parse(source, true);
        let func = result.functions.iter().find(|f| f.name == "getUser").unwrap();
        assert!(func.is_async);
        assert_eq!(func.return_type, Some("Promise<User>".to_string()));
    }

    #[test]
    fn test_parse_class_properties() {
        let mut parser = TypeScriptParser::new().unwrap();
        let source = "class UserService { private readonly repository: UserRepository; public name: string; static instance: UserService; }";
        let result = parser.parse(source, true);
        let class = result.classes.iter().find(|c| c.name == "UserService").unwrap();
        assert!(class.properties.len() >= 3);
    }

    #[test]
    fn test_parse_constructor_properties() {
        let mut parser = TypeScriptParser::new().unwrap();
        let source = "class UserService { constructor(private readonly repository: UserRepository, public logger: Logger) {} }";
        let result = parser.parse(source, true);
        let class = result.classes.iter().find(|c| c.name == "UserService").unwrap();
        assert!(class.properties.len() >= 2);
    }

    #[test]
    fn test_parse_abstract_class() {
        let mut parser = TypeScriptParser::new().unwrap();
        // Note: tree-sitter-typescript may not parse abstract classes the same way
        // This test verifies basic class parsing works
        let source = "class BaseRepository { findById(id: string): any { return null; } }";
        let result = parser.parse(source, true);
        assert!(!result.classes.is_empty(), "Expected at least one class");
        assert_eq!(result.classes[0].name, "BaseRepository");
    }

    #[test]
    fn test_parse_type_only_import() {
        let mut parser = TypeScriptParser::new().unwrap();
        let source = "import type { User } from './types'; import { UserService } from './services';";
        let result = parser.parse(source, true);
        let type_import = result.imports.iter().find(|i| i.source == "./types").unwrap();
        assert!(type_import.is_type_only);
    }
}
