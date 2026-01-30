//! Python parser using native tree-sitter
//!
//! Extracts functions, classes, imports, and call sites from Python code.
//! Supports decorators for FastAPI, Django, Flask, and other frameworks.
//!
//! Enterprise features:
//! - Decorator extraction (@decorator syntax)
//! - Parameter extraction with types and default values
//! - Return type extraction (-> Type)
//! - Docstring extraction ("""...""")
//! - Base class extraction (multiple inheritance)
//! - Generator detection (yield)
//! - Class property extraction

use std::time::Instant;
use tree_sitter::{Node, Parser, Query, QueryCursor};

use super::types::*;

/// Python parser
pub struct PythonParser {
    parser: Parser,
    function_query: Query,
    class_query: Query,
    import_query: Query,
    call_query: Query,
}

impl PythonParser {
    /// Create a new Python parser
    pub fn new() -> Result<Self, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_python::LANGUAGE;
        parser.set_language(&language.into())
            .map_err(|e| format!("Failed to set language: {}", e))?;
        
        // Query for functions
        let function_query = Query::new(
            &language.into(),
            r#"
            (function_definition
                name: (identifier) @name
                parameters: (parameters) @params
                return_type: (type)? @return_type
                body: (block) @body
            ) @function
            
            (decorated_definition
                (decorator) @decorator
                definition: (function_definition
                    name: (identifier) @name
                    parameters: (parameters) @params
                )
            ) @decorated_function
            "#,
        ).map_err(|e| format!("Failed to create function query: {}", e))?;
        
        // Query for classes - handles both decorated and non-decorated classes
        // We use a simpler query and manually extract bases and decorators
        let class_query = Query::new(
            &language.into(),
            r#"
            (class_definition
                name: (identifier) @name
            ) @class
            
            (decorated_definition
                definition: (class_definition
                    name: (identifier) @name
                ) @inner_class
            ) @decorated_class
            "#,
        ).map_err(|e| format!("Failed to create class query: {}", e))?;
        
        // Query for imports
        let import_query = Query::new(
            &language.into(),
            r#"
            (import_statement
                name: (dotted_name) @module
            ) @import
            
            (import_from_statement
                module_name: (dotted_name) @module
                name: [
                    (dotted_name) @name
                    (aliased_import name: (dotted_name) @name)
                ]*
            ) @from_import
            "#,
        ).map_err(|e| format!("Failed to create import query: {}", e))?;
        
        // Query for function calls
        let call_query = Query::new(
            &language.into(),
            r#"
            (call
                function: [
                    (identifier) @callee
                    (attribute
                        object: (_) @receiver
                        attribute: (identifier) @callee
                    )
                ]
                arguments: (argument_list) @args
            ) @call
            "#,
        ).map_err(|e| format!("Failed to create call query: {}", e))?;
        
        Ok(Self {
            parser,
            function_query,
            class_query,
            import_query,
            call_query,
        })
    }
    
    /// Parse Python source code
    pub fn parse(&mut self, source: &str) -> ParseResult {
        let start = Instant::now();
        
        let tree = match self.parser.parse(source, None) {
            Some(t) => t,
            None => {
                let mut result = ParseResult::new(Language::Python);
                result.errors.push(ParseError {
                    message: "Failed to parse source".to_string(),
                    range: Range::new(0, 0, 0, 0),
                });
                return result;
            }
        };
        
        let root = tree.root_node();
        let source_bytes = source.as_bytes();
        
        let mut result = ParseResult::with_tree(Language::Python, tree.clone());
        
        self.extract_functions(&root, source_bytes, &mut result);
        self.extract_classes(&root, source_bytes, &mut result);
        self.extract_imports(&root, source_bytes, &mut result);
        self.extract_calls(&root, source_bytes, &mut result);
        
        result.parse_time_us = start.elapsed().as_micros() as u64;
        result
    }
    
    fn extract_functions(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        // First pass: collect all decorated function lines to avoid duplicates
        let mut decorated_lines = std::collections::HashSet::new();
        {
            let mut cursor = QueryCursor::new();
            for m in cursor.matches(&self.function_query, *root, source) {
                for capture in m.captures {
                    let capture_name = self.function_query.capture_names()[capture.index as usize];
                    if capture_name == "decorated_function" {
                        // Find the inner function_definition to get its line
                        let mut inner_cursor = capture.node.walk();
                        if inner_cursor.goto_first_child() {
                            loop {
                                let child = inner_cursor.node();
                                if child.kind() == "function_definition" {
                                    decorated_lines.insert(child.start_position().row);
                                    break;
                                }
                                if !inner_cursor.goto_next_sibling() {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Second pass: extract functions
        // Track which functions we've already processed to avoid duplicates
        let mut processed = std::collections::HashSet::new();
        let mut cursor = QueryCursor::new();
        
        for m in cursor.matches(&self.function_query, *root, source) {
            let mut name = String::new();
            let mut decorators = Vec::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_async = false;
            let mut is_decorated = false;
            let mut inner_func_line: Option<u32> = None;
            let mut func_node: Option<Node> = None;
            let mut params_node: Option<Node> = None;
            let mut return_type: Option<String> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.function_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "decorator" => {
                        decorators.push(node.utf8_text(source).unwrap_or("").to_string());
                    }
                    "params" => {
                        params_node = Some(node);
                    }
                    "return_type" => {
                        return_type = Some(node.utf8_text(source).unwrap_or("").to_string());
                    }
                    "function" => {
                        range = node_range(&node);
                        inner_func_line = Some(node.start_position().row as u32);
                        func_node = Some(node);
                        // Check if async
                        if let Some(first_child) = node.child(0) {
                            if first_child.kind() == "async" {
                                is_async = true;
                            }
                        }
                    }
                    "decorated_function" => {
                        range = node_range(&node);
                        is_decorated = true;
                        
                        // Extract ALL decorators from the decorated_definition
                        decorators = self.extract_decorators(&node, source);
                        
                        // Find the inner function_definition and extract parameters immediately
                        let mut inner_cursor = node.walk();
                        if inner_cursor.goto_first_child() {
                            loop {
                                let child = inner_cursor.node();
                                if child.kind() == "function_definition" {
                                    inner_func_line = Some(child.start_position().row as u32);
                                    func_node = Some(child);
                                    
                                    // Check if async
                                    if let Some(first_child) = child.child(0) {
                                        if first_child.kind() == "async" {
                                            is_async = true;
                                        }
                                    }
                                    
                                    // Extract return type from the function_definition
                                    return_type = self.extract_return_type(&child, source);
                                    
                                    // Find and store parameters node from the function_definition
                                    // We need to find it within the child's children
                                    let mut func_cursor = child.walk();
                                    if func_cursor.goto_first_child() {
                                        loop {
                                            let func_child = func_cursor.node();
                                            if func_child.kind() == "parameters" {
                                                params_node = Some(func_child);
                                                break;
                                            }
                                            if !func_cursor.goto_next_sibling() {
                                                break;
                                            }
                                        }
                                    }
                                    
                                    break;
                                }
                                if !inner_cursor.goto_next_sibling() {
                                    break;
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            
            if !name.is_empty() {
                // Skip plain function matches if they're part of a decorated_definition
                if !is_decorated {
                    if let Some(line) = inner_func_line {
                        if decorated_lines.contains(&(line as usize)) {
                            continue;
                        }
                    }
                }
                
                // Create a key based on name and start line to deduplicate
                let key = (name.clone(), range.start.line);
                if processed.contains(&key) {
                    continue;
                }
                processed.insert(key);
                
                // Extract parameters
                let parameters = params_node
                    .map(|n| self.extract_parameters(&n, source))
                    .unwrap_or_default();
                
                // Extract docstring
                let doc_comment = func_node
                    .and_then(|n| self.extract_docstring(&n, source));
                
                // Check if generator (contains yield)
                let is_generator = func_node
                    .map(|n| self.contains_yield(&n, source))
                    .unwrap_or(false);
                
                result.functions.push(FunctionInfo {
                    name,
                    qualified_name: None,
                    parameters,
                    return_type,
                    is_exported: true, // Python functions are "exported" by default
                    is_async,
                    is_generator,
                    range,
                    decorators,
                    doc_comment,
                });
            }
        }
    }
    
    /// Extract parameters from a parameters node
    fn extract_parameters(&self, params_node: &Node, source: &[u8]) -> Vec<ParameterInfo> {
        let mut parameters = Vec::new();
        
        let mut cursor = params_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        // Simple parameter without type annotation
                        let name = child.utf8_text(source).unwrap_or("").to_string();
                        if !name.is_empty() && name != "self" && name != "cls" {
                            parameters.push(ParameterInfo {
                                name,
                                type_annotation: None,
                                default_value: None,
                                is_rest: false,
                            });
                        }
                    }
                    "typed_parameter" => {
                        if let Some(param) = self.extract_typed_parameter(&child, source) {
                            parameters.push(param);
                        }
                    }
                    "default_parameter" => {
                        if let Some(param) = self.extract_default_parameter(&child, source) {
                            parameters.push(param);
                        }
                    }
                    "typed_default_parameter" => {
                        if let Some(param) = self.extract_typed_default_parameter(&child, source) {
                            parameters.push(param);
                        }
                    }
                    "list_splat_pattern" | "dictionary_splat_pattern" => {
                        // *args or **kwargs
                        if let Some(param) = self.extract_splat_parameter(&child, source) {
                            parameters.push(param);
                        }
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
    
    /// Extract a typed parameter (name: Type)
    fn extract_typed_parameter(&self, node: &Node, source: &[u8]) -> Option<ParameterInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        if name.is_empty() {
                            name = child.utf8_text(source).unwrap_or("").to_string();
                        }
                    }
                    "type" => {
                        type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    _ => {}
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        if name.is_empty() || name == "self" || name == "cls" {
            return None;
        }
        
        Some(ParameterInfo {
            name,
            type_annotation,
            default_value: None,
            is_rest: false,
        })
    }
    
    /// Extract a default parameter (name=value)
    fn extract_default_parameter(&self, node: &Node, source: &[u8]) -> Option<ParameterInfo> {
        let mut name = String::new();
        let mut default_value = None;
        
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        if name.is_empty() {
                            name = child.utf8_text(source).unwrap_or("").to_string();
                        }
                    }
                    _ => {
                        // The value after = 
                        if name.is_empty() {
                            continue;
                        }
                        if child.kind() != "=" {
                            default_value = Some(child.utf8_text(source).unwrap_or("").to_string());
                        }
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        if name.is_empty() || name == "self" || name == "cls" {
            return None;
        }
        
        Some(ParameterInfo {
            name,
            type_annotation: None,
            default_value,
            is_rest: false,
        })
    }
    
    /// Extract a typed default parameter (name: Type = value)
    fn extract_typed_default_parameter(&self, node: &Node, source: &[u8]) -> Option<ParameterInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut default_value = None;
        let mut found_equals = false;
        
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        if name.is_empty() {
                            name = child.utf8_text(source).unwrap_or("").to_string();
                        }
                    }
                    "type" => {
                        type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    "=" => {
                        found_equals = true;
                    }
                    _ => {
                        if found_equals && default_value.is_none() {
                            default_value = Some(child.utf8_text(source).unwrap_or("").to_string());
                        }
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        if name.is_empty() || name == "self" || name == "cls" {
            return None;
        }
        
        Some(ParameterInfo {
            name,
            type_annotation,
            default_value,
            is_rest: false,
        })
    }
    
    /// Extract *args or **kwargs parameter
    fn extract_splat_parameter(&self, node: &Node, source: &[u8]) -> Option<ParameterInfo> {
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "identifier" {
                    let name = child.utf8_text(source).unwrap_or("").to_string();
                    if !name.is_empty() {
                        return Some(ParameterInfo {
                            name,
                            type_annotation: None,
                            default_value: None,
                            is_rest: true,
                        });
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        None
    }
    
    /// Extract docstring from a function body
    fn extract_docstring(&self, func_node: &Node, source: &[u8]) -> Option<String> {
        // Look for block child, then expression_statement with string
        let mut cursor = func_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "block" {
                    // First statement in block might be docstring
                    let mut block_cursor = child.walk();
                    if block_cursor.goto_first_child() {
                        loop {
                            let stmt = block_cursor.node();
                            if stmt.kind() == "expression_statement" {
                                // Check if it's a string literal
                                if let Some(expr) = stmt.child(0) {
                                    if expr.kind() == "string" {
                                        let doc = expr.utf8_text(source).unwrap_or("");
                                        // Clean up the docstring
                                        return Some(self.clean_docstring(doc));
                                    }
                                }
                            }
                            // Only check first non-comment statement
                            if stmt.kind() != "comment" {
                                break;
                            }
                            if !block_cursor.goto_next_sibling() {
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
        None
    }
    
    /// Clean up a docstring by removing quotes and normalizing whitespace
    fn clean_docstring(&self, doc: &str) -> String {
        let doc = doc.trim();
        // Remove triple quotes
        let doc = if doc.starts_with("\"\"\"") && doc.ends_with("\"\"\"") {
            &doc[3..doc.len()-3]
        } else if doc.starts_with("'''") && doc.ends_with("'''") {
            &doc[3..doc.len()-3]
        } else if doc.starts_with("\"") && doc.ends_with("\"") {
            &doc[1..doc.len()-1]
        } else if doc.starts_with("'") && doc.ends_with("'") {
            &doc[1..doc.len()-1]
        } else {
            doc
        };
        
        // Normalize whitespace
        doc.lines()
            .map(|l| l.trim())
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string()
    }
    
    /// Check if a function contains yield (is a generator)
    fn contains_yield(&self, node: &Node, _source: &[u8]) -> bool {
        let mut stack = vec![*node];
        while let Some(current) = stack.pop() {
            if current.kind() == "yield" || current.kind() == "yield_statement" {
                return true;
            }
            // Don't recurse into nested function definitions
            if current.kind() == "function_definition" && current.id() != node.id() {
                continue;
            }
            let mut cursor = current.walk();
            if cursor.goto_first_child() {
                loop {
                    stack.push(cursor.node());
                    if !cursor.goto_next_sibling() {
                        break;
                    }
                }
            }
        }
        false
    }
    
    /// Extract return type from a function_definition node
    fn extract_return_type(&self, func_node: &Node, source: &[u8]) -> Option<String> {
        let mut cursor = func_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "type" {
                    return Some(child.utf8_text(source).unwrap_or("").to_string());
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        None
    }
    
    /// Find the parameters node in a function_definition
    fn find_parameters_node<'a>(&self, func_node: &'a Node) -> Option<Node<'a>> {
        let mut cursor = func_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "parameters" {
                    return Some(child);
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        None
    }
    
    fn extract_classes(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.class_query, *root, source);
        
        // Track which classes we've already processed to avoid duplicates
        let mut processed_ranges = std::collections::HashSet::new();
        
        for m in matches {
            let mut name = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut class_node: Option<Node> = None;
            let mut decorated_node: Option<Node> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.class_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "class" => {
                        range = node_range(&node);
                        class_node = Some(node);
                    }
                    "inner_class" => {
                        class_node = Some(node);
                    }
                    "decorated_class" => {
                        range = node_range(&node);
                        decorated_node = Some(node);
                    }
                    _ => {}
                }
            }
            
            // Skip if we've already processed this class
            let range_key = (range.start.line, range.start.column, range.end.line, range.end.column);
            if processed_ranges.contains(&range_key) {
                continue;
            }
            
            if !name.is_empty() {
                processed_ranges.insert(range_key);
                
                // Extract base classes from the class_definition node
                let bases = class_node
                    .map(|n| self.extract_base_classes(&n, source))
                    .unwrap_or_default();
                
                // Extract decorators from the decorated_definition node
                let decorators = decorated_node
                    .map(|n| self.extract_decorators(&n, source))
                    .unwrap_or_default();
                
                // Python uses multiple inheritance - first base is "extends", rest are "implements"
                let extends = bases.first().cloned();
                let implements: Vec<String> = bases.into_iter().skip(1).collect();
                
                // Extract class properties (class-level assignments with type annotations)
                let properties = class_node
                    .map(|n| self.extract_class_properties(&n, source))
                    .unwrap_or_default();
                
                // Check if abstract (has ABC in bases or @abstractmethod decorators)
                let is_abstract = decorators.iter().any(|d| d.contains("abstract")) ||
                    extends.as_ref().map(|e| e.contains("ABC")).unwrap_or(false);
                
                result.classes.push(ClassInfo {
                    name,
                    extends,
                    implements,
                    is_exported: true,
                    is_abstract,
                    methods: Vec::new(),
                    properties,
                    range,
                    decorators,
                });
            }
        }
    }
    
    /// Extract class-level properties (type-annotated assignments)
    fn extract_class_properties(&self, class_node: &Node, source: &[u8]) -> Vec<PropertyInfo> {
        let mut properties = Vec::new();
        
        // Find the block child (class body)
        let mut cursor = class_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "block" {
                    // Look for assignments and type annotations in the class body
                    let mut body_cursor = child.walk();
                    if body_cursor.goto_first_child() {
                        loop {
                            let stmt = body_cursor.node();
                            match stmt.kind() {
                                "expression_statement" => {
                                    // Could be a type annotation like: name: str
                                    if let Some(expr) = stmt.child(0) {
                                        if expr.kind() == "assignment" {
                                            if let Some(prop) = self.extract_assignment_property(&expr, source) {
                                                properties.push(prop);
                                            }
                                        }
                                    }
                                }
                                "type" => {
                                    // Type annotation without assignment: name: str
                                    // This is actually handled differently in tree-sitter
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
    
    /// Extract a property from an assignment expression
    fn extract_assignment_property(&self, node: &Node, source: &[u8]) -> Option<PropertyInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        
        let mut cursor = node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        if name.is_empty() {
                            name = child.utf8_text(source).unwrap_or("").to_string();
                        }
                    }
                    "type" => {
                        type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    _ => {}
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        // Skip private attributes (starting with _) and dunder methods
        if name.is_empty() || name.starts_with("_") {
            return None;
        }
        
        Some(PropertyInfo {
            name,
            type_annotation,
            is_static: false,
            is_readonly: false,
            visibility: Visibility::Public,
            tags: None,
        })
    }
    
    /// Extract base classes from a class_definition node
    fn extract_base_classes(&self, class_node: &Node, source: &[u8]) -> Vec<String> {
        let mut bases = Vec::new();
        
        // Look for argument_list child (superclasses)
        let mut cursor = class_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "argument_list" {
                    // Walk through argument_list children to find identifiers
                    let mut arg_cursor = child.walk();
                    if arg_cursor.goto_first_child() {
                        loop {
                            let arg_child = arg_cursor.node();
                            match arg_child.kind() {
                                "identifier" => {
                                    let base_name = arg_child.utf8_text(source).unwrap_or("");
                                    if !base_name.is_empty() {
                                        bases.push(base_name.to_string());
                                    }
                                }
                                "attribute" => {
                                    // Handle cases like models.Model
                                    let attr_text = arg_child.utf8_text(source).unwrap_or("");
                                    if !attr_text.is_empty() {
                                        bases.push(attr_text.to_string());
                                    }
                                }
                                _ => {}
                            }
                            if !arg_cursor.goto_next_sibling() {
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
        
        bases
    }
    
    /// Extract decorators from a decorated_definition node
    fn extract_decorators(&self, decorated_node: &Node, source: &[u8]) -> Vec<String> {
        let mut decorators = Vec::new();
        
        // Walk through children looking for decorator nodes
        let mut cursor = decorated_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "decorator" {
                    let dec_text = child.utf8_text(source).unwrap_or("");
                    if !dec_text.is_empty() {
                        decorators.push(dec_text.to_string());
                    }
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        decorators
    }
    
    fn extract_imports(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.import_query, *root, source);
        
        for m in matches {
            let mut module = String::new();
            let mut names = Vec::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_from_import = false;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.import_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "module" => {
                        module = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "name" => {
                        names.push(node.utf8_text(source).unwrap_or("").to_string());
                    }
                    "import" => {
                        range = node_range(&node);
                    }
                    "from_import" => {
                        range = node_range(&node);
                        is_from_import = true;
                    }
                    _ => {}
                }
            }
            
            if !module.is_empty() {
                result.imports.push(ImportInfo {
                    source: module,
                    named: if is_from_import { names.clone() } else { Vec::new() },
                    default: if !is_from_import { names.first().cloned() } else { None },
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

impl Default for PythonParser {
    fn default() -> Self {
        Self::new().expect("Failed to create Python parser")
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
        let mut parser = PythonParser::new().unwrap();
        let result = parser.parse("def hello(name: str) -> None:\n    print(name)");
        
        assert_eq!(result.functions.len(), 1);
        assert_eq!(result.functions[0].name, "hello");
    }

    #[test]
    fn test_parse_class() {
        let mut parser = PythonParser::new().unwrap();
        let result = parser.parse("class MyClass(Base):\n    pass");
        
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "MyClass");
    }

    #[test]
    fn test_parse_import() {
        let mut parser = PythonParser::new().unwrap();
        let result = parser.parse("from typing import List, Dict");
        
        assert_eq!(result.imports.len(), 1);
        assert_eq!(result.imports[0].source, "typing");
    }

    #[test]
    fn test_parse_fastapi_class() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
@dataclass
@router.api_route('/users')
class UserView(APIView, PermissionMixin):
    pass
"#;
        let result = parser.parse(source);
        
        // Should find the class
        assert!(!result.classes.is_empty());
        let user_view = result.classes.iter().find(|c| c.name == "UserView");
        assert!(user_view.is_some(), "Should find UserView class");
        
        let user_view = user_view.unwrap();
        assert_eq!(user_view.extends, Some("APIView".to_string()));
        assert!(user_view.implements.contains(&"PermissionMixin".to_string()));
        
        // Should have decorators
        assert!(!user_view.decorators.is_empty(), "Should have decorators");
        assert!(user_view.decorators.iter().any(|d| d.contains("dataclass")));
    }

    #[test]
    fn test_parse_django_model() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
class User(models.Model):
    name = models.CharField(max_length=100)
    
    class Meta:
        db_table = 'users'
"#;
        let result = parser.parse(source);
        
        // Should find both User and Meta classes
        assert!(result.classes.len() >= 1);
        
        let user = result.classes.iter().find(|c| c.name == "User");
        assert!(user.is_some());
        // Note: models.Model is an attribute access, not a simple identifier
        // The current query only captures simple identifiers as bases
    }

    #[test]
    fn test_parse_multiple_inheritance() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
class MyClass(Base1, Base2, Base3):
    pass
"#;
        let result = parser.parse(source);
        
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "MyClass");
        assert_eq!(result.classes[0].extends, Some("Base1".to_string()));
        assert!(result.classes[0].implements.contains(&"Base2".to_string()));
        assert!(result.classes[0].implements.contains(&"Base3".to_string()));
    }

    #[test]
    fn test_parse_decorated_function() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
@app.route('/users')
@login_required
def get_users():
    pass
"#;
        let result = parser.parse(source);
        
        assert_eq!(result.functions.len(), 1);
        assert_eq!(result.functions[0].name, "get_users");
        assert!(!result.functions[0].decorators.is_empty());
    }

    #[test]
    fn test_parse_simple_decorated_class() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
@dataclass
class User:
    name: str
    age: int
"#;
        let result = parser.parse(source);
        
        let user = result.classes.iter().find(|c| c.name == "User");
        assert!(user.is_some());
        let user = user.unwrap();
        assert!(user.decorators.iter().any(|d| d.contains("dataclass")));
    }
    
    // ==================== NEW ENTERPRISE FEATURE TESTS ====================
    
    #[test]
    fn test_parse_function_parameters() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
def process_data(name: str, count: int = 10, *args, **kwargs) -> dict:
    return {}
"#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "process_data").unwrap();
        
        // Check parameters
        assert!(func.parameters.len() >= 2, "Expected at least 2 parameters, got: {:?}", func.parameters);
        
        let name_param = func.parameters.iter().find(|p| p.name == "name");
        assert!(name_param.is_some(), "Should have 'name' parameter");
        assert_eq!(name_param.unwrap().type_annotation, Some("str".to_string()));
        
        let count_param = func.parameters.iter().find(|p| p.name == "count");
        assert!(count_param.is_some(), "Should have 'count' parameter");
        assert_eq!(count_param.unwrap().type_annotation, Some("int".to_string()));
        assert!(count_param.unwrap().default_value.is_some(), "count should have default value");
        
        // Check return type
        assert_eq!(func.return_type, Some("dict".to_string()));
    }
    
    #[test]
    fn test_parse_async_function() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        return await session.get(url)
"#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "fetch_data").unwrap();
        assert!(func.is_async, "Function should be async");
        assert_eq!(func.return_type, Some("dict".to_string()));
    }
    
    #[test]
    fn test_parse_generator_function() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
def generate_numbers(n: int):
    for i in range(n):
        yield i
"#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "generate_numbers").unwrap();
        assert!(func.is_generator, "Function should be a generator");
    }
    
    #[test]
    fn test_parse_docstring() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
def calculate_sum(a: int, b: int) -> int:
    """
    Calculate the sum of two numbers.
    
    Args:
        a: First number
        b: Second number
    
    Returns:
        The sum of a and b
    """
    return a + b
"#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "calculate_sum").unwrap();
        assert!(func.doc_comment.is_some(), "Function should have docstring");
        let doc = func.doc_comment.as_ref().unwrap();
        assert!(doc.contains("Calculate the sum"), "Docstring should contain description: {}", doc);
    }
    
    #[test]
    fn test_parse_fastapi_endpoint() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
@router.get("/users/{user_id}")
@requires_auth
async def get_user(user_id: int, db: Session = Depends(get_db)) -> User:
    """Get a user by ID."""
    return db.query(User).filter(User.id == user_id).first()
"#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "get_user").unwrap();
        
        println!("Decorators: {:?}", func.decorators);
        
        // Check decorators
        assert!(func.decorators.iter().any(|d| d.contains("router.get")),
            "Missing router.get, got: {:?}", func.decorators);
        // Note: The query only captures the first decorator in decorated_definition
        // This is a known limitation - we need to extract all decorators manually
        
        // Check async
        assert!(func.is_async);
        
        // Check parameters
        let user_id_param = func.parameters.iter().find(|p| p.name == "user_id");
        assert!(user_id_param.is_some());
        assert_eq!(user_id_param.unwrap().type_annotation, Some("int".to_string()));
        
        // Check return type
        assert_eq!(func.return_type, Some("User".to_string()));
        
        // Check docstring
        assert!(func.doc_comment.is_some());
    }
    
    #[test]
    fn test_parse_pydantic_model() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
from pydantic import BaseModel

class UserCreate(BaseModel):
    name: str
    email: str
    age: int = 0
    
    class Config:
        orm_mode = True
"#;
        let result = parser.parse(source);
        
        let user_create = result.classes.iter().find(|c| c.name == "UserCreate").unwrap();
        assert_eq!(user_create.extends, Some("BaseModel".to_string()));
    }
    
    #[test]
    fn test_parse_abstract_class() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
from abc import ABC, abstractmethod

class Repository(ABC):
    @abstractmethod
    def get(self, id: int):
        pass
    
    @abstractmethod
    def save(self, entity):
        pass
"#;
        let result = parser.parse(source);
        
        let repo = result.classes.iter().find(|c| c.name == "Repository").unwrap();
        assert!(repo.is_abstract, "Repository should be abstract");
    }
    
    #[test]
    fn test_parse_sqlalchemy_model() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    email = Column(String(255), unique=True)
    
    def __repr__(self):
        return f"<User {self.name}>"
"#;
        let result = parser.parse(source);
        
        let user = result.classes.iter().find(|c| c.name == "User").unwrap();
        assert_eq!(user.extends, Some("Base".to_string()));
    }
    
    #[test]
    fn test_parse_flask_route() {
        let mut parser = PythonParser::new().unwrap();
        let source = r#"
@app.route('/api/users', methods=['GET', 'POST'])
@login_required
def users():
    """Handle user requests."""
    if request.method == 'POST':
        return create_user()
    return get_users()
"#;
        let result = parser.parse(source);
        
        let func = result.functions.iter().find(|f| f.name == "users").unwrap();
        assert!(func.decorators.iter().any(|d| d.contains("app.route")));
        assert!(func.decorators.iter().any(|d| d.contains("login_required")));
        assert!(func.doc_comment.is_some());
    }
}
