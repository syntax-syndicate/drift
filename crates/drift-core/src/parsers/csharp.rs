//! C# parser using native tree-sitter
//!
//! Extracts functions, classes, imports, and call sites from C# code.
//! Supports ASP.NET Core, Entity Framework, and other framework attributes.
//!
//! Enterprise features:
//! - [Attribute] extraction for classes, methods, and properties
//! - ASP.NET Core route attributes ([HttpGet], [HttpPost], [Route], etc.)
//! - Authorization attributes ([Authorize], [AllowAnonymous])
//! - Entity Framework attributes ([Key], [Required], [ForeignKey], etc.)
//! - XML doc comments (/// <summary>)
//! - Parameter extraction with types
//! - Property extraction with attributes
//! - Namespace extraction

use std::time::Instant;
use tree_sitter::{Node, Parser, Query, QueryCursor};

use super::types::*;

/// C# parser with enterprise attribute support
pub struct CSharpParser {
    parser: Parser,
    method_query: Query,
    class_query: Query,
    using_query: Query,
    call_query: Query,
}

impl CSharpParser {
    pub fn new() -> Result<Self, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_c_sharp::LANGUAGE;
        parser.set_language(&language.into())
            .map_err(|e| format!("Failed to set language: {}", e))?;
        
        // Method query with modifiers
        let method_query = Query::new(
            &language.into(),
            r#"
            (method_declaration
                (modifier)* @modifier
                name: (identifier) @name
                parameters: (parameter_list) @params
            ) @method
            
            (constructor_declaration
                (modifier)* @modifier
                name: (identifier) @name
                parameters: (parameter_list) @params
            ) @constructor
            "#,
        ).map_err(|e| format!("Failed to create method query: {}", e))?;
        
        // Class query with base types
        let class_query = Query::new(
            &language.into(),
            r#"
            (class_declaration
                (modifier)* @modifier
                name: (identifier) @name
            ) @class
            
            (interface_declaration
                (modifier)* @modifier
                name: (identifier) @name
            ) @interface
            
            (struct_declaration
                (modifier)* @modifier
                name: (identifier) @name
            ) @struct
            
            (record_declaration
                (modifier)* @modifier
                name: (identifier) @name
            ) @record
            "#,
        ).map_err(|e| format!("Failed to create class query: {}", e))?;
        
        let using_query = Query::new(
            &language.into(),
            r#"
            (using_directive
                (qualified_name) @namespace
            ) @using
            "#,
        ).map_err(|e| format!("Failed to create using query: {}", e))?;

        // Call query with receiver extraction
        let call_query = Query::new(
            &language.into(),
            r#"
            (invocation_expression
                function: [
                    (identifier) @callee
                    (member_access_expression
                        expression: (_) @receiver
                        name: (identifier) @callee
                    )
                ]
                arguments: (argument_list) @args
            ) @call
            "#,
        ).map_err(|e| format!("Failed to create call query: {}", e))?;
        
        Ok(Self {
            parser,
            method_query,
            class_query,
            using_query,
            call_query,
        })
    }
    
    pub fn parse(&mut self, source: &str) -> ParseResult {
        let start = Instant::now();
        
        let tree = match self.parser.parse(source, None) {
            Some(t) => t,
            None => {
                let mut result = ParseResult::new(Language::CSharp);
                result.errors.push(ParseError {
                    message: "Failed to parse source".to_string(),
                    range: Range::new(0, 0, 0, 0),
                });
                return result;
            }
        };
        
        let root = tree.root_node();
        let source_bytes = source.as_bytes();
        
        let mut result = ParseResult::with_tree(Language::CSharp, tree.clone());
        
        self.extract_methods(&root, source_bytes, &mut result);
        self.extract_classes(&root, source_bytes, &mut result);
        self.extract_usings(&root, source_bytes, &mut result);
        self.extract_calls(&root, source_bytes, &mut result);
        
        result.parse_time_us = start.elapsed().as_micros() as u64;
        result
    }
    
    fn extract_methods(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.method_query, *root, source);
        
        for m in matches {
            let mut name = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_public = false;
            let mut is_async = false;
            let mut method_node: Option<Node> = None;
            let mut params_node: Option<Node> = None;
            let mut return_type: Option<String> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.method_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "modifier" => {
                        let modifier = node.utf8_text(source).unwrap_or("");
                        match modifier {
                            "public" => is_public = true,
                            "async" => is_async = true,
                            _ => {}
                        }
                    }
                    "params" => {
                        params_node = Some(node);
                    }
                    "method" => {
                        range = node_range(&node);
                        method_node = Some(node);
                        // Extract return type from method node
                        return_type = self.extract_return_type(&node, source);
                    }
                    "constructor" => {
                        range = node_range(&node);
                        method_node = Some(node);
                    }
                    _ => {}
                }
            }
            
            if !name.is_empty() {
                // Extract attributes
                let decorators = method_node
                    .map(|n| self.extract_attributes_for_declaration(&n, source))
                    .unwrap_or_default();
                
                // Extract XML doc comment
                let doc_comment = method_node
                    .and_then(|n| self.extract_xml_doc_comment(&n, source));
                
                // Extract parameters
                let parameters = params_node
                    .map(|n| self.extract_parameters(&n, source))
                    .unwrap_or_default();
                
                result.functions.push(FunctionInfo {
                    name,
                    qualified_name: None,
                    parameters,
                    return_type,
                    is_exported: is_public,
                    is_async,
                    is_generator: false,
                    range,
                    decorators,
                    doc_comment,
                });
            }
        }
    }
    
    /// Extract return type from a method declaration node
    fn extract_return_type(&self, method_node: &Node, source: &[u8]) -> Option<String> {
        let mut cursor = method_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                let kind = child.kind();
                // Look for type nodes that come before the method name
                if kind == "predefined_type" || kind == "generic_name" || 
                   kind == "nullable_type" || kind == "qualified_name" ||
                   kind == "array_type" || kind == "identifier" {
                    // Make sure it's not the method name
                    let text = child.utf8_text(source).unwrap_or("");
                    if !text.is_empty() {
                        return Some(text.to_string());
                    }
                }
                if child.kind() == "identifier" {
                    // This is likely the method name, stop looking
                    break;
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        None
    }

    /// Extract [Attribute] decorators from a declaration node
    /// In C#, attributes are children of the declaration node (not siblings)
    fn extract_attributes_for_declaration(&self, node: &Node, source: &[u8]) -> Vec<String> {
        let mut decorators = Vec::new();
        
        // In C#, attribute_list nodes are children of the declaration
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "attribute_list" {
                    let attrs = self.extract_attributes_from_list(&child, source);
                    decorators.extend(attrs);
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        decorators
    }
    
    /// Extract attributes from an attribute_list node [Attr1, Attr2]
    fn extract_attributes_from_list(&self, node: &Node, source: &[u8]) -> Vec<String> {
        let mut attrs = Vec::new();
        
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "attribute" {
                    if let Some(attr) = self.format_attribute(&child, source) {
                        attrs.push(attr);
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        attrs
    }
    
    /// Format a single attribute node as a string
    fn format_attribute(&self, node: &Node, source: &[u8]) -> Option<String> {
        let mut name = String::new();
        let mut args = String::new();
        
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" | "qualified_name" => {
                        if name.is_empty() {
                            name = child.utf8_text(source).unwrap_or("").to_string();
                        }
                    }
                    "attribute_argument_list" => {
                        args = child.utf8_text(source).unwrap_or("").to_string();
                    }
                    _ => {}
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        if name.is_empty() {
            return None;
        }
        
        // Format as [Name] or [Name(args)]
        if args.is_empty() {
            Some(format!("[{}]", name))
        } else {
            Some(format!("[{}{}]", name, args))
        }
    }
    
    /// Extract XML doc comments (/// <summary>)
    /// Doc comments are siblings that appear before the declaration in the parent's children
    fn extract_xml_doc_comment(&self, node: &Node, source: &[u8]) -> Option<String> {
        let mut doc_lines = Vec::new();
        
        // Look for comment siblings before this node
        let mut sibling = node.prev_sibling();
        while let Some(sib) = sibling {
            match sib.kind() {
                "comment" => {
                    let text = sib.utf8_text(source).unwrap_or("");
                    // Check for XML doc comment (///)
                    if text.starts_with("///") {
                        let content = text.strip_prefix("///").unwrap_or("").trim();
                        doc_lines.insert(0, content.to_string());
                    } else {
                        // Regular comment, stop looking
                        break;
                    }
                }
                _ => {
                    // Stop at non-comment nodes
                    break;
                }
            }
            sibling = sib.prev_sibling();
        }
        
        if doc_lines.is_empty() {
            None
        } else {
            // Clean up XML tags for readability
            let doc = doc_lines.join("\n");
            Some(self.clean_xml_doc(&doc))
        }
    }
    
    /// Clean XML doc comment tags
    fn clean_xml_doc(&self, doc: &str) -> String {
        doc.replace("<summary>", "")
           .replace("</summary>", "")
           .replace("<param name=\"", "@param ")
           .replace("\">", " - ")
           .replace("</param>", "")
           .replace("<returns>", "@returns ")
           .replace("</returns>", "")
           .replace("<remarks>", "")
           .replace("</remarks>", "")
           .replace("<exception cref=\"", "@throws ")
           .replace("</exception>", "")
           .lines()
           .map(|l| l.trim())
           .filter(|l| !l.is_empty())
           .collect::<Vec<_>>()
           .join("\n")
    }
    
    /// Extract method parameters with types
    fn extract_parameters(&self, params_node: &Node, source: &[u8]) -> Vec<ParameterInfo> {
        let mut parameters = Vec::new();
        
        let mut cursor = params_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "parameter" {
                    if let Some(param) = self.extract_single_parameter(&child, source) {
                        parameters.push(param);
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        parameters
    }
    
    /// Extract a single parameter
    fn extract_single_parameter(&self, node: &Node, source: &[u8]) -> Option<ParameterInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut default_value = None;
        let mut is_params = false;
        let mut found_equals = false;
        
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                let kind = child.kind();
                
                // If we found an equals sign, the next value is the default
                if found_equals {
                    // This is the default value
                    default_value = Some(child.utf8_text(source).unwrap_or("").to_string());
                    found_equals = false;
                } else {
                    match kind {
                        "identifier" => {
                            // Only set name if we don't have one yet (first identifier is type if it's a custom type)
                            if name.is_empty() {
                                name = child.utf8_text(source).unwrap_or("").to_string();
                            }
                        }
                        "predefined_type" | "nullable_type" | "generic_name" | 
                        "qualified_name" | "array_type" => {
                            if type_annotation.is_none() {
                                type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                            }
                        }
                        "=" => {
                            // Next sibling will be the default value
                            found_equals = true;
                        }
                        "equals_value_clause" => {
                            // Alternative: default value in equals_value_clause
                            if let Some(value_node) = child.child(1) {
                                default_value = Some(value_node.utf8_text(source).unwrap_or("").to_string());
                            }
                        }
                        "parameter_modifier" => {
                            let modifier = child.utf8_text(source).unwrap_or("");
                            if modifier == "params" {
                                is_params = true;
                            }
                        }
                        _ => {}
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        // Handle case where identifier was actually the type (custom type like UserDto)
        // In C#, the last identifier before = or ) is the parameter name
        // We need to re-parse to get this right
        if type_annotation.is_none() && !name.is_empty() {
            // Check if there's another identifier that should be the name
            let mut cursor = node.walk();
            let mut identifiers = Vec::new();
            if cursor.goto_first_child() {
                loop {
                    let child = cursor.node();
                    if child.kind() == "identifier" {
                        identifiers.push(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    if !cursor.goto_next_sibling() {
                        break;
                    }
                }
            }
            if identifiers.len() >= 2 {
                // First identifier is type, last is name
                type_annotation = Some(identifiers[0].clone());
                name = identifiers[identifiers.len() - 1].clone();
            }
        }
        
        if name.is_empty() {
            return None;
        }
        
        Some(ParameterInfo {
            name,
            type_annotation,
            default_value,
            is_rest: is_params,
        })
    }

    fn extract_classes(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.class_query, *root, source);
        
        for m in matches {
            let mut name = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_public = false;
            let mut is_abstract = false;
            let mut class_node: Option<Node> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.class_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "modifier" => {
                        let modifier = node.utf8_text(source).unwrap_or("");
                        match modifier {
                            "public" => is_public = true,
                            "abstract" => is_abstract = true,
                            _ => {}
                        }
                    }
                    "class" | "struct" | "record" => {
                        range = node_range(&node);
                        class_node = Some(node);
                    }
                    "interface" => {
                        range = node_range(&node);
                        class_node = Some(node);
                        is_abstract = true;
                    }
                    _ => {}
                }
            }
            
            if !name.is_empty() {
                // Extract attributes
                let decorators = class_node
                    .map(|n| self.extract_attributes_for_declaration(&n, source))
                    .unwrap_or_default();
                
                // Extract properties from the class body
                let properties = class_node
                    .map(|n| self.extract_class_properties(&n, source))
                    .unwrap_or_default();
                
                // Extract base types (extends/implements)
                let (extends, implements) = class_node
                    .map(|n| self.extract_base_types(&n, source))
                    .unwrap_or((None, Vec::new()));
                
                result.classes.push(ClassInfo {
                    name,
                    extends,
                    implements,
                    is_exported: is_public,
                    is_abstract,
                    methods: Vec::new(),
                    properties,
                    range,
                    decorators,
                });
            }
        }
    }
    
    /// Extract base types (extends and implements) from a class declaration
    fn extract_base_types(&self, class_node: &Node, source: &[u8]) -> (Option<String>, Vec<String>) {
        let mut extends = None;
        let mut implements = Vec::new();
        
        let mut cursor = class_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "base_list" {
                    // Extract all base types
                    let mut base_cursor = child.walk();
                    if base_cursor.goto_first_child() {
                        loop {
                            let base_child = base_cursor.node();
                            if base_child.kind() == "identifier" || 
                               base_child.kind() == "generic_name" ||
                               base_child.kind() == "qualified_name" {
                                let base_name = base_child.utf8_text(source).unwrap_or("").to_string();
                                if !base_name.is_empty() {
                                    if extends.is_none() {
                                        extends = Some(base_name);
                                    } else {
                                        implements.push(base_name);
                                    }
                                }
                            }
                            if !base_cursor.goto_next_sibling() {
                                break;
                            }
                        }
                    }
                    break;
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        (extends, implements)
    }

    /// Extract properties from a class body
    fn extract_class_properties(&self, class_node: &Node, source: &[u8]) -> Vec<PropertyInfo> {
        let mut properties = Vec::new();
        
        // Find the declaration_list child (class body)
        let mut cursor = class_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "declaration_list" {
                    // Extract properties from the body
                    let mut body_cursor = child.walk();
                    if body_cursor.goto_first_child() {
                        loop {
                            let member = body_cursor.node();
                            match member.kind() {
                                "property_declaration" => {
                                    if let Some(prop) = self.extract_property(&member, source) {
                                        properties.push(prop);
                                    }
                                }
                                "field_declaration" => {
                                    if let Some(prop) = self.extract_field(&member, source) {
                                        properties.push(prop);
                                    }
                                }
                                _ => {}
                            }
                            if !body_cursor.goto_next_sibling() {
                                break;
                            }
                        }
                    }
                    break;
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        properties
    }
    
    /// Extract a property declaration
    fn extract_property(&self, node: &Node, source: &[u8]) -> Option<PropertyInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut is_public = false;
        let mut is_static = false;
        let mut is_readonly = false;
        
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        name = child.utf8_text(source).unwrap_or("").to_string();
                    }
                    "modifier" => {
                        let modifier = child.utf8_text(source).unwrap_or("");
                        match modifier {
                            "public" => is_public = true,
                            "static" => is_static = true,
                            "readonly" => is_readonly = true,
                            _ => {}
                        }
                    }
                    _ => {
                        // Capture type
                        if type_annotation.is_none() && child.is_named() {
                            let kind = child.kind();
                            if kind.contains("type") || kind == "predefined_type" || 
                               kind == "generic_name" || kind == "nullable_type" ||
                               kind == "qualified_name" || kind == "array_type" {
                                type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                            }
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
        
        // Extract property attributes
        let attrs = self.extract_attributes_for_declaration(node, source);
        let tags = if !attrs.is_empty() {
            Some(attrs.iter().map(|a| StructTag {
                key: "attribute".to_string(),
                value: a.clone(),
            }).collect())
        } else {
            None
        };
        
        Some(PropertyInfo {
            name,
            type_annotation,
            is_static,
            is_readonly,
            visibility: if is_public { Visibility::Public } else { Visibility::Private },
            tags,
        })
    }
    
    /// Extract a field declaration
    fn extract_field(&self, node: &Node, source: &[u8]) -> Option<PropertyInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut is_public = false;
        let mut is_static = false;
        let mut is_readonly = false;
        
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "modifier" => {
                        let modifier = child.utf8_text(source).unwrap_or("");
                        match modifier {
                            "public" => is_public = true,
                            "static" => is_static = true,
                            "readonly" => is_readonly = true,
                            _ => {}
                        }
                    }
                    "variable_declaration" => {
                        // Extract type and name from variable declaration
                        let mut var_cursor = child.walk();
                        if var_cursor.goto_first_child() {
                            loop {
                                let var_child = var_cursor.node();
                                match var_child.kind() {
                                    "variable_declarator" => {
                                        // Get the identifier
                                        if let Some(id) = var_child.child_by_field_name("name") {
                                            name = id.utf8_text(source).unwrap_or("").to_string();
                                        } else {
                                            // Try first child
                                            let mut decl_cursor = var_child.walk();
                                            if decl_cursor.goto_first_child() {
                                                let first = decl_cursor.node();
                                                if first.kind() == "identifier" {
                                                    name = first.utf8_text(source).unwrap_or("").to_string();
                                                }
                                            }
                                        }
                                    }
                                    _ => {
                                        // Capture type
                                        if type_annotation.is_none() && var_child.is_named() {
                                            let kind = var_child.kind();
                                            if kind.contains("type") || kind == "predefined_type" || 
                                               kind == "generic_name" || kind == "nullable_type" ||
                                               kind == "qualified_name" || kind == "array_type" ||
                                               kind == "identifier" {
                                                let text = var_child.utf8_text(source).unwrap_or("");
                                                if !text.is_empty() && text != name {
                                                    type_annotation = Some(text.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                                if !var_cursor.goto_next_sibling() {
                                    break;
                                }
                            }
                        }
                    }
                    _ => {}
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        if name.is_empty() {
            return None;
        }
        
        // Extract field attributes
        let attrs = self.extract_attributes_for_declaration(node, source);
        let tags = if !attrs.is_empty() {
            Some(attrs.iter().map(|a| StructTag {
                key: "attribute".to_string(),
                value: a.clone(),
            }).collect())
        } else {
            None
        };
        
        Some(PropertyInfo {
            name,
            type_annotation,
            is_static,
            is_readonly,
            visibility: if is_public { Visibility::Public } else { Visibility::Private },
            tags,
        })
    }
    
    /// Extract the enclosing namespace (kept for potential future use)
    #[allow(dead_code)]
    fn extract_enclosing_namespace(&self, node: &Node, source: &[u8]) -> Option<String> {
        let mut current = node.parent();
        while let Some(parent) = current {
            if parent.kind() == "namespace_declaration" {
                // Find the namespace name
                let mut cursor = parent.walk();
                if cursor.goto_first_child() {
                    loop {
                        let child = cursor.node();
                        if child.kind() == "qualified_name" || child.kind() == "identifier" {
                            return Some(child.utf8_text(source).unwrap_or("").to_string());
                        }
                        if !cursor.goto_next_sibling() {
                            break;
                        }
                    }
                }
            }
            // Also check for file-scoped namespace
            if parent.kind() == "file_scoped_namespace_declaration" {
                let mut cursor = parent.walk();
                if cursor.goto_first_child() {
                    loop {
                        let child = cursor.node();
                        if child.kind() == "qualified_name" || child.kind() == "identifier" {
                            return Some(child.utf8_text(source).unwrap_or("").to_string());
                        }
                        if !cursor.goto_next_sibling() {
                            break;
                        }
                    }
                }
            }
            current = parent.parent();
        }
        None
    }
    
    fn extract_usings(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.using_query, *root, source);
        
        for m in matches {
            let mut namespace = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.using_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "namespace" => {
                        namespace = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "using" => {
                        range = node_range(&node);
                    }
                    _ => {}
                }
            }
            
            if !namespace.is_empty() {
                result.imports.push(ImportInfo {
                    source: namespace,
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

impl Default for CSharpParser {
    fn default() -> Self {
        Self::new().expect("Failed to create C# parser")
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
    fn test_parse_class() {
        let mut parser = CSharpParser::new().unwrap();
        let result = parser.parse("public class UserService { }");
        
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "UserService");
        assert!(result.classes[0].is_exported);
    }
    
    #[test]
    fn test_parse_method() {
        let mut parser = CSharpParser::new().unwrap();
        let result = parser.parse("public class Test { public void Hello() { } }");
        
        assert!(result.functions.len() >= 1);
        let hello = result.functions.iter().find(|f| f.name == "Hello").unwrap();
        assert!(hello.is_exported);
    }

    #[test]
    fn test_parse_method_call_with_receiver() {
        let mut parser = CSharpParser::new().unwrap();
        let result = parser.parse("public class Test { void M() { _context.SaveChanges(); } }");
        
        assert!(result.calls.len() >= 1);
        let call = result.calls.iter().find(|c| c.callee == "SaveChanges").unwrap();
        assert_eq!(call.receiver, Some("_context".to_string()));
    }

    #[test]
    fn test_parse_linq_chain() {
        let mut parser = CSharpParser::new().unwrap();
        let result = parser.parse("public class Test { void M() { users.Where(u => u.Active).ToList(); } }");
        
        // Should capture both Where and ToList calls
        assert!(result.calls.len() >= 2);
        let where_call = result.calls.iter().find(|c| c.callee == "Where").unwrap();
        assert_eq!(where_call.receiver, Some("users".to_string()));
    }

    #[test]
    fn test_parse_ef_core_pattern() {
        let mut parser = CSharpParser::new().unwrap();
        let result = parser.parse("public class Test { void M() { _context.Users.FirstOrDefaultAsync(); } }");
        
        assert!(result.calls.len() >= 1);
        let call = result.calls.iter().find(|c| c.callee == "FirstOrDefaultAsync").unwrap();
        assert!(call.receiver.is_some());
    }
    
    // ==================== NEW ATTRIBUTE TESTS ====================
    
    #[test]
    fn test_parse_api_controller_attributes() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() { return Ok(); }
    
    [HttpGet("{id}")]
    public IActionResult GetById(int id) { return Ok(); }
    
    [HttpPost]
    [Authorize]
    public IActionResult Create([FromBody] UserDto user) { return Ok(); }
}
"#;
        let result = parser.parse(source);
        
        // Check class attributes
        let controller = result.classes.iter().find(|c| c.name == "UsersController").unwrap();
        assert!(controller.decorators.iter().any(|d| d.contains("ApiController")),
            "Missing ApiController, got: {:?}", controller.decorators);
        assert!(controller.decorators.iter().any(|d| d.contains("Route")),
            "Missing Route, got: {:?}", controller.decorators);
        
        // Check method attributes
        let get_all = result.functions.iter().find(|f| f.name == "GetAll").unwrap();
        assert!(get_all.decorators.iter().any(|d| d.contains("HttpGet")),
            "Missing HttpGet, got: {:?}", get_all.decorators);
        
        let create = result.functions.iter().find(|f| f.name == "Create").unwrap();
        assert!(create.decorators.iter().any(|d| d.contains("HttpPost")),
            "Missing HttpPost, got: {:?}", create.decorators);
        assert!(create.decorators.iter().any(|d| d.contains("Authorize")),
            "Missing Authorize, got: {:?}", create.decorators);
    }
    
    #[test]
    fn test_parse_entity_framework_attributes() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public class User
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Email { get; set; }
    
    [ForeignKey("Department")]
    public int DepartmentId { get; set; }
}
"#;
        let result = parser.parse(source);
        
        let user = result.classes.iter().find(|c| c.name == "User").unwrap();
        
        // Check that properties have attributes in tags
        let id_prop = user.properties.iter().find(|p| p.name == "Id").unwrap();
        assert!(id_prop.tags.is_some(), "Expected tags on Id property");
        let id_tags = id_prop.tags.as_ref().unwrap();
        assert!(id_tags.iter().any(|t| t.value.contains("Key")),
            "Missing Key attribute, got: {:?}", id_tags);
        
        let email_prop = user.properties.iter().find(|p| p.name == "Email").unwrap();
        assert!(email_prop.tags.is_some(), "Expected tags on Email property");
        let email_tags = email_prop.tags.as_ref().unwrap();
        assert!(email_tags.iter().any(|t| t.value.contains("Required")),
            "Missing Required attribute, got: {:?}", email_tags);
    }
    
    #[test]
    fn test_parse_async_method() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public class UserService
{
    public async Task<User> GetUserAsync(int id)
    {
        return await _context.Users.FindAsync(id);
    }
}
"#;
        let result = parser.parse(source);
        
        let method = result.functions.iter().find(|f| f.name == "GetUserAsync").unwrap();
        assert!(method.is_async, "Expected async method");
        assert!(method.return_type.as_ref().unwrap().contains("Task"),
            "Expected Task return type, got: {:?}", method.return_type);
    }
    
    #[test]
    fn test_parse_method_parameters() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public class Calculator
{
    public int Add(int a, int b, int c = 0)
    {
        return a + b + c;
    }
}
"#;
        let result = parser.parse(source);
        
        let method = result.functions.iter().find(|f| f.name == "Add").unwrap();
        assert_eq!(method.parameters.len(), 3, "Expected 3 parameters, got: {:?}", method.parameters);
        
        assert_eq!(method.parameters[0].name, "a");
        assert_eq!(method.parameters[1].name, "b");
        assert_eq!(method.parameters[2].name, "c");
        
        // Check default value
        assert!(method.parameters[2].default_value.is_some(),
            "Expected default value for c, got: {:?}", method.parameters[2]);
    }
    
    #[test]
    fn test_parse_xml_doc_comment() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public class UserService
{
    /// <summary>
    /// Gets a user by their unique identifier.
    /// </summary>
    /// <param name="id">The user's ID</param>
    /// <returns>The user if found, null otherwise</returns>
    public User GetUser(int id)
    {
        return null;
    }
}
"#;
        let result = parser.parse(source);
        
        let method = result.functions.iter().find(|f| f.name == "GetUser").unwrap();
        assert!(method.doc_comment.is_some(), "Expected doc comment");
        let doc = method.doc_comment.as_ref().unwrap();
        assert!(doc.contains("Gets a user"), "Doc should contain description: {}", doc);
    }
    
    #[test]
    fn test_parse_interface() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public interface IUserRepository
{
    Task<User> GetByIdAsync(int id);
    Task<IEnumerable<User>> GetAllAsync();
}
"#;
        let result = parser.parse(source);
        
        let interface = result.classes.iter().find(|c| c.name == "IUserRepository").unwrap();
        assert!(interface.is_abstract, "Interface should be abstract");
        assert!(interface.is_exported);
    }
    
    #[test]
    fn test_parse_class_inheritance() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public class UserService : BaseService, IUserService, IDisposable
{
}
"#;
        let result = parser.parse(source);
        
        let class = result.classes.iter().find(|c| c.name == "UserService").unwrap();
        assert_eq!(class.extends, Some("BaseService".to_string()));
        assert!(class.implements.contains(&"IUserService".to_string()) || 
                class.implements.contains(&"IDisposable".to_string()),
            "Expected implements, got: {:?}", class.implements);
    }
    
    #[test]
    fn test_parse_sealed_class() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public sealed class SingletonService
{
    private static readonly SingletonService _instance = new();
    public static SingletonService Instance => _instance;
}
"#;
        let result = parser.parse(source);
        
        let class = result.classes.iter().find(|c| c.name == "SingletonService").unwrap();
        // Note: is_final not available in ClassInfo, but we can verify the class was parsed
        assert!(class.is_exported, "Sealed class should be exported");
    }
    
    #[test]
    fn test_parse_abstract_class() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public abstract class BaseRepository<T>
{
    public abstract Task<T> GetByIdAsync(int id);
}
"#;
        let result = parser.parse(source);
        
        let class = result.classes.iter().find(|c| c.name == "BaseRepository").unwrap();
        assert!(class.is_abstract, "Abstract class should be marked as abstract");
    }
    
    #[test]
    fn test_parse_record() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public record UserDto(int Id, string Name, string Email);
"#;
        let result = parser.parse(source);
        
        let record = result.classes.iter().find(|c| c.name == "UserDto").unwrap();
        assert!(record.is_exported);
    }
    
    #[test]
    fn test_parse_struct() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public struct Point
{
    public int X { get; set; }
    public int Y { get; set; }
}
"#;
        let result = parser.parse(source);
        
        let struct_type = result.classes.iter().find(|c| c.name == "Point").unwrap();
        assert!(struct_type.is_exported);
        assert!(struct_type.properties.len() >= 2);
    }
    
    #[test]
    fn test_parse_multiple_attributes() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public class AdminController
{
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult DeleteUser(int id)
    {
        return Ok();
    }
}
"#;
        let result = parser.parse(source);
        
        let method = result.functions.iter().find(|f| f.name == "DeleteUser").unwrap();
        assert!(method.decorators.len() >= 3, 
            "Expected at least 3 attributes, got: {:?}", method.decorators);
        assert!(method.decorators.iter().any(|d| d.contains("Authorize")));
        assert!(method.decorators.iter().any(|d| d.contains("ProducesResponseType")));
    }
    
    #[test]
    fn test_parse_validation_attributes() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public class CreateUserRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; }
    
    [Required]
    [MinLength(8)]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$")]
    public string Password { get; set; }
}
"#;
        let result = parser.parse(source);
        
        let class = result.classes.iter().find(|c| c.name == "CreateUserRequest").unwrap();
        
        let email_prop = class.properties.iter().find(|p| p.name == "Email").unwrap();
        assert!(email_prop.tags.is_some());
        let email_tags = email_prop.tags.as_ref().unwrap();
        assert!(email_tags.iter().any(|t| t.value.contains("Required")));
        assert!(email_tags.iter().any(|t| t.value.contains("EmailAddress")));
    }
    
    #[test]
    fn test_parse_dependency_injection() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public class UserService
{
    private readonly IUserRepository _repository;
    private readonly ILogger<UserService> _logger;
    
    public UserService(IUserRepository repository, ILogger<UserService> logger)
    {
        _repository = repository;
        _logger = logger;
    }
}
"#;
        let result = parser.parse(source);
        
        // Check constructor is parsed
        let ctor = result.functions.iter().find(|f| f.name == "UserService").unwrap();
        assert!(ctor.parameters.len() >= 2, "Expected constructor parameters");
    }
    
    #[test]
    fn test_parse_minimal_api_attributes() {
        let mut parser = CSharpParser::new().unwrap();
        let source = r#"
public static class UserEndpoints
{
    [HttpGet("/users")]
    [Authorize]
    [Tags("Users")]
    public static IResult GetUsers([FromServices] IUserService service)
    {
        return Results.Ok();
    }
}
"#;
        let result = parser.parse(source);
        
        let method = result.functions.iter().find(|f| f.name == "GetUsers").unwrap();
        assert!(method.decorators.iter().any(|d| d.contains("HttpGet")));
        assert!(method.decorators.iter().any(|d| d.contains("Authorize")));
        assert!(method.decorators.iter().any(|d| d.contains("Tags")));
    }
}
