//! Java parser using native tree-sitter
//!
//! Extracts functions, classes, imports, and call sites from Java code.
//! Supports Spring, JPA, and other framework annotations.
//!
//! Enterprise features:
//! - Annotation extraction (@Service, @GetMapping, @Autowired, etc.)
//! - Parameter extraction with types
//! - Return type extraction
//! - Javadoc comment extraction
//! - Base class and interface extraction
//! - Visibility modifiers (public, private, protected)
//! - Abstract class detection

use std::time::Instant;
use tree_sitter::{Node, Parser, Query, QueryCursor};

use super::types::*;

/// Java parser
pub struct JavaParser {
    parser: Parser,
    method_query: Query,
    class_query: Query,
    import_query: Query,
    call_query: Query,
}

impl JavaParser {
    pub fn new() -> Result<Self, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_java::LANGUAGE;
        parser.set_language(&language.into())
            .map_err(|e| format!("Failed to set language: {}", e))?;
        
        let method_query = Query::new(
            &language.into(),
            r#"
            (method_declaration
                (modifiers)? @modifiers
                type: (_) @return_type
                name: (identifier) @name
                parameters: (formal_parameters) @params
            ) @method
            
            (constructor_declaration
                (modifiers)? @modifiers
                name: (identifier) @name
                parameters: (formal_parameters) @params
            ) @constructor
            "#,
        ).map_err(|e| format!("Failed to create method query: {}", e))?;

        let class_query = Query::new(
            &language.into(),
            r#"
            (class_declaration
                (modifiers)? @modifiers
                name: (identifier) @name
                (superclass (type_identifier) @extends)?
                (super_interfaces (type_list (type_identifier) @implements))?
            ) @class
            
            (interface_declaration
                (modifiers)? @interface_modifiers
                name: (identifier) @interface_name
                (extends_interfaces (type_list (type_identifier) @extends_interface))?
            ) @interface
            "#,
        ).map_err(|e| format!("Failed to create class query: {}", e))?;
        
        let import_query = Query::new(
            &language.into(),
            r#"
            (import_declaration
                (scoped_identifier) @import
            ) @import_stmt
            "#,
        ).map_err(|e| format!("Failed to create import query: {}", e))?;
        
        let call_query = Query::new(
            &language.into(),
            r#"
            (method_invocation
                object: (_)? @receiver
                name: (identifier) @callee
                arguments: (argument_list) @args
            ) @call
            "#,
        ).map_err(|e| format!("Failed to create call query: {}", e))?;
        
        Ok(Self {
            parser,
            method_query,
            class_query,
            import_query,
            call_query,
        })
    }
    
    pub fn parse(&mut self, source: &str) -> ParseResult {
        let start = Instant::now();
        
        let tree = match self.parser.parse(source, None) {
            Some(t) => t,
            None => {
                let mut result = ParseResult::new(Language::Java);
                result.errors.push(ParseError {
                    message: "Failed to parse source".to_string(),
                    range: Range::new(0, 0, 0, 0),
                });
                return result;
            }
        };

        let root = tree.root_node();
        let source_bytes = source.as_bytes();
        
        let mut result = ParseResult::with_tree(Language::Java, tree.clone());
        
        self.extract_methods(&root, source_bytes, &mut result);
        self.extract_classes(&root, source_bytes, &mut result);
        self.extract_imports(&root, source_bytes, &mut result);
        self.extract_calls(&root, source_bytes, &mut result);
        
        result.parse_time_us = start.elapsed().as_micros() as u64;
        result
    }
    
    /// Extract annotations from a modifiers node
    fn extract_annotations(&self, modifiers_node: &Node, source: &[u8]) -> Vec<String> {
        let mut annotations = Vec::new();
        
        let mut cursor = modifiers_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "marker_annotation" | "annotation" => {
                        // Extract the full annotation text
                        let ann_text = child.utf8_text(source).unwrap_or("");
                        if !ann_text.is_empty() {
                            annotations.push(ann_text.to_string());
                        }
                    }
                    _ => {}
                }
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
        }
        
        annotations
    }
    
    /// Extract parameters from a formal_parameters node
    fn extract_parameters(&self, params_node: &Node, source: &[u8]) -> Vec<ParameterInfo> {
        let mut parameters = Vec::new();
        
        let mut cursor = params_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                if child.kind() == "formal_parameter" || child.kind() == "spread_parameter" {
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
    fn extract_single_parameter(&self, param_node: &Node, source: &[u8]) -> Option<ParameterInfo> {
        let mut name = String::new();
        let mut type_annotation = None;
        let mut is_rest = param_node.kind() == "spread_parameter";
        
        let mut cursor = param_node.walk();
        if cursor.goto_first_child() {
            loop {
                let child = cursor.node();
                match child.kind() {
                    "identifier" => {
                        name = child.utf8_text(source).unwrap_or("").to_string();
                    }
                    "type_identifier" | "generic_type" | "array_type" | "integral_type" | 
                    "floating_point_type" | "boolean_type" | "void_type" => {
                        type_annotation = Some(child.utf8_text(source).unwrap_or("").to_string());
                    }
                    "..." => {
                        is_rest = true;
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
        
        Some(ParameterInfo {
            name,
            type_annotation,
            default_value: None, // Java doesn't have default parameter values
            is_rest,
        })
    }
    
    /// Extract Javadoc comment preceding a node
    fn extract_javadoc(&self, node: &Node, source: &[u8]) -> Option<String> {
        // Look for block_comment sibling before this node
        if let Some(prev) = node.prev_sibling() {
            if prev.kind() == "block_comment" {
                let comment = prev.utf8_text(source).unwrap_or("");
                if comment.starts_with("/**") {
                    return Some(self.clean_javadoc(comment));
                }
            }
        }
        
        // Also check parent's previous sibling (for methods inside class body)
        if let Some(parent) = node.parent() {
            if let Some(prev) = parent.prev_sibling() {
                if prev.kind() == "block_comment" {
                    let comment = prev.utf8_text(source).unwrap_or("");
                    if comment.starts_with("/**") {
                        return Some(self.clean_javadoc(comment));
                    }
                }
            }
        }
        
        None
    }

    /// Clean up Javadoc comment
    fn clean_javadoc(&self, doc: &str) -> String {
        let doc = doc.trim();
        // Remove /** and */
        let doc = if doc.starts_with("/**") && doc.ends_with("*/") {
            &doc[3..doc.len()-2]
        } else {
            doc
        };
        
        // Clean up each line - remove leading * and whitespace
        doc.lines()
            .map(|line| {
                let trimmed = line.trim();
                if trimmed.starts_with("*") {
                    trimmed[1..].trim()
                } else {
                    trimmed
                }
            })
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n")
    }
    
    fn extract_methods(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.method_query, *root, source);
        
        for m in matches {
            let mut name = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_public = false;
            let mut _is_static = false;
            let mut is_async = false;
            let mut return_type: Option<String> = None;
            let mut annotations = Vec::new();
            let mut parameters = Vec::new();
            let mut method_node: Option<Node> = None;
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.method_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "modifiers" => {
                        let mods = node.utf8_text(source).unwrap_or("");
                        is_public = mods.contains("public");
                        _is_static = mods.contains("static");
                        // Check for CompletableFuture or async-related annotations
                        is_async = mods.contains("@Async");
                        
                        // Extract annotations from modifiers
                        annotations = self.extract_annotations(&node, source);
                    }
                    "return_type" => {
                        let rt = node.utf8_text(source).unwrap_or("").to_string();
                        if !rt.is_empty() {
                            return_type = Some(rt);
                        }
                    }
                    "params" => {
                        parameters = self.extract_parameters(&node, source);
                    }
                    "method" | "constructor" => {
                        range = node_range(&node);
                        method_node = Some(node);
                    }
                    _ => {}
                }
            }

            if !name.is_empty() {
                // Extract Javadoc
                let doc_comment = method_node.and_then(|n| self.extract_javadoc(&n, source));
                
                result.functions.push(FunctionInfo {
                    name,
                    qualified_name: None,
                    parameters,
                    return_type,
                    is_exported: is_public,
                    is_async,
                    is_generator: false,
                    range,
                    decorators: annotations,
                    doc_comment,
                });
            }
        }
    }
    
    fn extract_classes(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.class_query, *root, source);
        
        for m in matches {
            let mut name = String::new();
            let mut extends = None;
            let mut implements = Vec::new();
            let mut range = Range::new(0, 0, 0, 0);
            let mut is_public = false;
            let mut is_abstract = false;
            let mut annotations = Vec::new();
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.class_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "name" | "interface_name" => {
                        name = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "extends" => {
                        extends = Some(node.utf8_text(source).unwrap_or("").to_string());
                    }
                    "implements" => {
                        implements.push(node.utf8_text(source).unwrap_or("").to_string());
                    }
                    "extends_interface" => {
                        // For interfaces, extends acts like implements
                        implements.push(node.utf8_text(source).unwrap_or("").to_string());
                    }
                    "modifiers" | "interface_modifiers" => {
                        let mods = node.utf8_text(source).unwrap_or("");
                        is_public = mods.contains("public");
                        // Only set is_abstract from modifiers if not already set (interfaces are implicitly abstract)
                        if !is_abstract {
                            is_abstract = mods.contains("abstract");
                        }
                        
                        // Extract annotations from modifiers
                        annotations = self.extract_annotations(&node, source);
                    }
                    "class" => {
                        range = node_range(&node);
                    }
                    "interface" => {
                        range = node_range(&node);
                        is_abstract = true; // Interfaces are implicitly abstract
                    }
                    _ => {}
                }
            }

            if !name.is_empty() {
                result.classes.push(ClassInfo {
                    name,
                    extends,
                    implements,
                    is_exported: is_public,
                    is_abstract,
                    methods: Vec::new(),
                    properties: Vec::new(),
                    range,
                    decorators: annotations,
                });
            }
        }
    }
    
    fn extract_imports(&self, root: &Node, source: &[u8], result: &mut ParseResult) {
        let mut cursor = QueryCursor::new();
        let matches = cursor.matches(&self.import_query, *root, source);
        
        for m in matches {
            let mut import_path = String::new();
            let mut range = Range::new(0, 0, 0, 0);
            
            for capture in m.captures {
                let node = capture.node;
                let capture_name = self.import_query.capture_names()[capture.index as usize];
                
                match capture_name {
                    "import" => {
                        import_path = node.utf8_text(source).unwrap_or("").to_string();
                    }
                    "import_stmt" => {
                        range = node_range(&node);
                    }
                    _ => {}
                }
            }
            
            if !import_path.is_empty() {
                // Extract class name from full path
                let class_name = import_path.rsplit('.').next().unwrap_or(&import_path).to_string();
                result.imports.push(ImportInfo {
                    source: import_path,
                    named: vec![class_name],
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

impl Default for JavaParser {
    fn default() -> Self {
        Self::new().expect("Failed to create Java parser")
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
        let mut parser = JavaParser::new().unwrap();
        let result = parser.parse("public class UserService extends BaseService implements IUserService { }");
        
        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "UserService");
        assert_eq!(result.classes[0].extends, Some("BaseService".to_string()));
        assert!(result.classes[0].implements.contains(&"IUserService".to_string()));
    }

    #[test]
    fn test_parse_method() {
        let mut parser = JavaParser::new().unwrap();
        let result = parser.parse("public class Test { public void hello(String name) { } }");
        
        assert!(result.functions.len() >= 1);
        let method = result.functions.iter().find(|f| f.name == "hello").unwrap();
        assert!(method.is_exported);
    }

    #[test]
    fn test_parse_imports() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
            import java.util.List;
            import java.util.Map;
            import org.springframework.stereotype.Service;
            
            public class Test { }
        "#;
        let result = parser.parse(source);
        
        assert!(result.imports.len() >= 3);
        assert!(result.imports.iter().any(|i| i.source.contains("java.util.List")));
    }

    #[test]
    fn test_parse_spring_annotations() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
@Service
@Transactional
public class UserService {
    @Autowired
    private UserRepository repo;
}
        "#;
        let result = parser.parse(source);
        
        assert_eq!(result.classes.len(), 1);
        let class = &result.classes[0];
        assert_eq!(class.name, "UserService");
        assert!(class.decorators.iter().any(|d| d.contains("Service")), 
            "Expected @Service annotation, got: {:?}", class.decorators);
        assert!(class.decorators.iter().any(|d| d.contains("Transactional")),
            "Expected @Transactional annotation, got: {:?}", class.decorators);
    }

    #[test]
    fn test_parse_abstract_class() {
        let mut parser = JavaParser::new().unwrap();
        let source = "public abstract class BaseRepository { public abstract void save(); }";
        let result = parser.parse(source);
        
        assert_eq!(result.classes.len(), 1);
        assert!(result.classes[0].is_abstract);
    }

    #[test]
    fn test_parse_interface() {
        let mut parser = JavaParser::new().unwrap();
        let source = "public interface UserRepository extends JpaRepository { }";
        let result = parser.parse(source);
        
        assert!(!result.classes.is_empty(), "Should find at least one class");
        let iface = result.classes.iter().find(|c| c.name == "UserRepository").unwrap();
        assert!(iface.is_abstract, "Interface should be abstract");
        assert!(iface.is_exported, "Interface should be public");
    }

    #[test]
    fn test_parse_method_calls() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
            public class Test {
                public void process() {
                    repo.save(entity);
                    logger.info("done");
                }
            }
        "#;
        let result = parser.parse(source);
        
        assert!(result.calls.iter().any(|c| c.callee == "save"));
        assert!(result.calls.iter().any(|c| c.callee == "info"));
    }

    #[test]
    fn test_parse_multiple_classes() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
            public class User { }
            class UserDTO { }
            public class UserMapper { }
        "#;
        let result = parser.parse(source);
        
        assert!(result.classes.len() >= 2);
    }
    
    // ==================== NEW ENTERPRISE FEATURE TESTS ====================
    
    #[test]
    fn test_parse_spring_controller_annotations() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
    
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public User createUser(@RequestBody @Valid UserDTO dto) {
        return userService.create(dto);
    }
}
        "#;
        let result = parser.parse(source);
        
        // Check class annotations
        let controller = result.classes.iter().find(|c| c.name == "UserController").unwrap();
        assert!(controller.decorators.iter().any(|d| d.contains("RestController")),
            "Expected @RestController, got: {:?}", controller.decorators);
        assert!(controller.decorators.iter().any(|d| d.contains("RequestMapping")),
            "Expected @RequestMapping, got: {:?}", controller.decorators);
        
        // Check method annotations
        let get_user = result.functions.iter().find(|f| f.name == "getUser").unwrap();
        assert!(get_user.decorators.iter().any(|d| d.contains("GetMapping")),
            "Expected @GetMapping, got: {:?}", get_user.decorators);
        assert!(get_user.decorators.iter().any(|d| d.contains("PreAuthorize")),
            "Expected @PreAuthorize, got: {:?}", get_user.decorators);
        
        let create_user = result.functions.iter().find(|f| f.name == "createUser").unwrap();
        assert!(create_user.decorators.iter().any(|d| d.contains("PostMapping")),
            "Expected @PostMapping, got: {:?}", create_user.decorators);
    }

    #[test]
    fn test_parse_method_parameters() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
public class UserService {
    public User findUser(Long id, String name, boolean active) {
        return null;
    }
}
        "#;
        let result = parser.parse(source);
        
        let method = result.functions.iter().find(|f| f.name == "findUser").unwrap();
        assert_eq!(method.parameters.len(), 3, "Expected 3 parameters, got: {:?}", method.parameters);
        
        let id_param = method.parameters.iter().find(|p| p.name == "id").unwrap();
        assert_eq!(id_param.type_annotation, Some("Long".to_string()));
        
        let name_param = method.parameters.iter().find(|p| p.name == "name").unwrap();
        assert_eq!(name_param.type_annotation, Some("String".to_string()));
        
        let active_param = method.parameters.iter().find(|p| p.name == "active").unwrap();
        assert_eq!(active_param.type_annotation, Some("boolean".to_string()));
    }
    
    #[test]
    fn test_parse_return_type() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
public class UserService {
    public List<User> findAll() { return null; }
    public void delete(Long id) { }
    public CompletableFuture<User> findAsync(Long id) { return null; }
}
        "#;
        let result = parser.parse(source);
        
        let find_all = result.functions.iter().find(|f| f.name == "findAll").unwrap();
        assert_eq!(find_all.return_type, Some("List<User>".to_string()));
        
        let delete = result.functions.iter().find(|f| f.name == "delete").unwrap();
        assert_eq!(delete.return_type, Some("void".to_string()));
        
        let find_async = result.functions.iter().find(|f| f.name == "findAsync").unwrap();
        assert_eq!(find_async.return_type, Some("CompletableFuture<User>".to_string()));
    }
    
    #[test]
    fn test_parse_jpa_entity() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
}
        "#;
        let result = parser.parse(source);
        
        let entity = result.classes.iter().find(|c| c.name == "User").unwrap();
        assert!(entity.decorators.iter().any(|d| d.contains("Entity")));
        assert!(entity.decorators.iter().any(|d| d.contains("Table")));
    }

    #[test]
    fn test_parse_varargs() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
public class Utils {
    public void log(String format, Object... args) { }
}
        "#;
        let result = parser.parse(source);
        
        let method = result.functions.iter().find(|f| f.name == "log").unwrap();
        assert!(method.parameters.len() >= 1);
        // Note: varargs detection depends on tree-sitter's spread_parameter handling
    }
    
    #[test]
    fn test_parse_generic_method() {
        let mut parser = JavaParser::new().unwrap();
        let source = r#"
public class Repository<T> {
    public Optional<T> findById(Long id) { return Optional.empty(); }
    public List<T> findAll() { return Collections.emptyList(); }
}
        "#;
        let result = parser.parse(source);
        
        let find_by_id = result.functions.iter().find(|f| f.name == "findById").unwrap();
        assert!(find_by_id.return_type.as_ref().unwrap().contains("Optional"));
    }
    
    #[test]
    fn test_parse_multiple_implements() {
        let mut parser = JavaParser::new().unwrap();
        let source = "public class UserService implements Serializable, Comparable<UserService> { }";
        let result = parser.parse(source);
        
        let class = result.classes.iter().find(|c| c.name == "UserService").unwrap();
        assert!(class.implements.len() >= 1, "Expected implements, got: {:?}", class.implements);
    }
}
