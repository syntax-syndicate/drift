# Semantic Data Access Scanner Roadmap

## Current State (v1.3)

All extractors now use tree-sitter for consistent, semantic-aware parsing. Full support for 5 languages with:
- **Data Access Extractors** - Detect ORM/database calls
- **Call Graph Extractors** - Build function call graphs for reachability analysis
- Auto-detection of project stack
- Improved CLI output

### Supported Languages

| Language | Data Access | Call Graph | Parser |
|----------|-------------|------------|--------|
| TypeScript/JS | ✅ Done | ✅ Done | tree-sitter / TS Compiler |
| Python | ✅ Done | ✅ Done | tree-sitter |
| C# | ✅ Done | ✅ Done | tree-sitter |
| Java | ✅ Done | ✅ Done | tree-sitter |
| PHP | ✅ Done | ✅ Done | tree-sitter |

### Supported ORMs & Frameworks

| Language | ORM/Framework | Status | Confidence |
|----------|---------------|--------|------------|
| TypeScript/JS | Supabase | ✅ Done | 0.95 |
| TypeScript/JS | Prisma | ✅ Done | 0.95 |
| TypeScript/JS | TypeORM | ✅ Done | 0.85 |
| TypeScript/JS | Sequelize | ✅ Done | 0.85 |
| TypeScript/JS | Drizzle | ✅ Done | 0.90 |
| TypeScript/JS | Knex | ✅ Done | 0.90 |
| TypeScript/JS | Mongoose | ✅ Done | 0.85 |
| TypeScript/JS | Raw SQL | ✅ Done | 0.80 |
| Python | Django ORM | ✅ Done | 0.95 |
| Python | SQLAlchemy | ✅ Done | 0.90 |
| Python | Supabase | ✅ Done | 0.95 |
| Python | Tortoise ORM | ✅ Done | 0.80 |
| Python | Peewee | ✅ Done | 0.80 |
| Python | Raw SQL | ✅ Done | 0.80 |
| C# | Entity Framework Core | ✅ Done | 0.95 |
| C# | Dapper | ✅ Done | 0.90 |
| C# | ADO.NET | ✅ Done | 0.70 |
| C# | EF Raw SQL | ✅ Done | 0.85 |
| C# | LINQ Queries | ✅ Done | 0.90 |
| Java | Spring Data JPA | ✅ Done | 0.95 |
| Java | Hibernate | ✅ Done | 0.90 |
| Java | JDBC | ✅ Done | 0.80 |
| Java | MyBatis | ✅ Done | 0.85 |
| Java | jOOQ | ✅ Done | 0.85 |
| PHP | Laravel Eloquent | ✅ Done | 0.95 |
| PHP | Laravel DB Facade | ✅ Done | 0.90 |
| PHP | Doctrine | ✅ Done | 0.85 |
| PHP | PDO | ✅ Done | 0.80 |

### Tree-Sitter Integration

All extractors now use tree-sitter for parsing:
- `tree-sitter-typescript` / `tree-sitter-javascript` for TS/JS
- `tree-sitter-python` for Python
- `tree-sitter-c-sharp` for C#
- `tree-sitter-java` for Java
- `tree-sitter-php` for PHP

This provides:
- Consistent AST structure across languages
- Better error recovery
- Faster parsing
- No dependency on language-specific compilers

### Auto-Detection & CLI Improvements

The scanner now includes:
- **Auto-detection of project stack** from package files (package.json, requirements.txt, composer.json, pom.xml, .csproj)
- **Improved CLI output** with:
  - Detected stack display (languages, ORMs, frameworks)
  - Visual bar charts for ORM and language breakdown
  - Tree-sitter vs regex fallback statistics
  - Error summaries with verbose mode hints
  - Next steps suggestions

---

## Call Graph Extractors

All 5 languages now have full call graph support:

### TypeScript/JavaScript
- Function declarations, arrow functions, function expressions
- Nested functions (closures)
- Class methods and constructors
- JSX component usage
- Module-level calls
- Callback patterns

### Python
- Function definitions (def, async def)
- Nested functions (closures)
- Class methods and static methods
- Module-level calls
- Dependency injection (FastAPI Depends)
- Lambda expressions

### C#
- Method definitions (regular, static, async)
- Constructors
- Properties with getters/setters
- Class hierarchies
- Namespace imports
- Lambda expressions
- LINQ queries
- ASP.NET controller actions

### Java
- Method definitions (regular, static, abstract)
- Constructors
- Class hierarchies (extends, implements)
- Package imports
- Lambda expressions
- Method references (::)
- Spring annotations

### PHP
- Function definitions
- Class methods (public, private, protected, static)
- Constructors and destructors
- Traits
- Namespaces and use statements
- Arrow functions (fn =>)
- Closures
- Laravel controller actions

---

## Phase 3: More ORMs per Language

### TypeScript/JavaScript Additions

| ORM/Framework | Patterns | Status |
|---------------|----------|--------|
| Mongoose | `User.find({})`, `user.save()` | ✅ Done |
| MikroORM | `em.find(User, {})` | Planned |
| Objection.js | `User.query().where()` | Planned |
| AWS DynamoDB | `docClient.get()`, `docClient.put()` | Planned |
| Firebase/Firestore | `db.collection('users').get()` | Planned |
| MongoDB native | `db.collection('users').find()` | Planned |

### Python Additions

| ORM/Framework | Patterns | Priority |
|---------------|----------|----------|
| PyMongo | `db.users.find({})` | High |
| Motor (async MongoDB) | `await db.users.find({})` | Medium |
| boto3 DynamoDB | `table.get_item()`, `table.put_item()` | High |
| Databases (async) | `await database.fetch_all()` | Medium |
| Pony ORM | `select(u for u in User)` | Low |

---

## Phase 4: Enhanced Field Extraction

### Current Capabilities
- Extract fields from `select()` clauses
- Extract fields from insert/update payloads (object literals)

### Planned Enhancements

1. **Where Clause Fields**
   ```typescript
   // Currently: table=users, fields=[]
   // Enhanced: table=users, fields=[id, email] (from where clause)
   supabase.from('users').select('*').eq('id', 1).eq('email', 'test@example.com')
   ```

2. **Variable Reference Tracking**
   ```typescript
   const fields = ['id', 'name', 'email'];
   // Currently: fields=[]
   // Enhanced: fields=[id, name, email] (resolved from variable)
   supabase.from('users').select(fields.join(','))
   ```

3. **Type-Based Inference**
   ```typescript
   // Use TypeScript types to infer fields
   interface User { id: number; name: string; email: string; }
   const user: User = await prisma.user.findFirst();
   // Infer: fields=[id, name, email] from User type
   ```

4. **Join/Include Tracking**
   ```typescript
   // Track related tables
   prisma.user.findMany({ include: { posts: true, profile: true } })
   // Enhanced: tables=[users, posts, profiles]
   ```

---

## Phase 5: Cross-File Analysis

### Variable Definition Tracking
```typescript
// file: db.ts
export const supabase = createClient(url, key);

// file: users.ts
import { supabase } from './db';
supabase.from('users').select('*');  // Know this is Supabase
```

### Repository Pattern Detection
```typescript
// file: user.repository.ts
class UserRepository {
  async findById(id: string) {
    return this.db.from('users').select('*').eq('id', id);
  }
}

// file: user.service.ts
// Track that userRepository.findById() accesses 'users' table
```

---

## Implementation Priority

### Completed ✅
1. ✅ TypeScript/JS data access extractor (tree-sitter)
2. ✅ Python data access extractor (tree-sitter)
3. ✅ C# data access extractor (tree-sitter)
4. ✅ Java data access extractor (tree-sitter)
5. ✅ PHP data access extractor (tree-sitter)
6. ✅ TypeScript/JS call graph extractor
7. ✅ Python call graph extractor (tree-sitter)
8. ✅ C# call graph extractor (tree-sitter)
9. ✅ Java call graph extractor (tree-sitter)
10. ✅ PHP call graph extractor (tree-sitter)
11. ✅ Unified scanner with fallback
12. ✅ Mongoose support
13. ✅ Auto-detection of project stack
14. ✅ Improved CLI output with visual charts

### Short-term (Next 2 Sprints)
1. Enhanced field extraction from where clauses
2. Variable reference tracking
3. MongoDB native driver support
4. Cross-file import/export tracking

### Medium-term (Next Quarter)
1. DynamoDB support
2. Firebase/Firestore support
3. Full cross-file analysis

### Long-term (Future)
1. Type-based inference
2. Full repository pattern detection

---

## Architecture Notes

### Adding a New Language Extractor

1. Create `{language}-data-access-extractor.ts` in `src/call-graph/extractors/`
2. Extend `BaseDataAccessExtractor`
3. Implement `extract(source, filePath)` method
4. Add ORM-specific pattern matchers
5. Export from `extractors/index.ts`
6. Register in `SemanticDataAccessScanner`

### Adding a New ORM to Existing Language

1. Add pattern to the appropriate extractor
2. Create `try{ORM}Pattern()` method
3. Add to the pattern chain in `analyzeCallExpression()`
4. Add tests

### Testing Strategy

1. Unit tests for each ORM pattern
2. Integration tests with real code samples
3. E2E tests against demo repos
4. Comparison tests: semantic vs regex accuracy
