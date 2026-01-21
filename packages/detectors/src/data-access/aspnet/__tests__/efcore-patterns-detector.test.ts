/**
 * Tests for Entity Framework Core Patterns Detector
 */

import { describe, it, expect } from 'vitest';
import { EfCorePatternsDetector } from '../efcore-patterns-detector.js';

describe('EfCorePatternsDetector', () => {
  const detector = new EfCorePatternsDetector();

  describe('analyzeEfCore', () => {
    it('should detect DbContext inheritance', () => {
      const content = `
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Order> Orders { get; set; }
}
`;
      const analysis = detector.analyzeEfCore(content, 'ApplicationDbContext.cs');
      
      expect(analysis.dbContexts).toContain('ApplicationDbContext');
      expect(analysis.entityTypes).toContain('User');
      expect(analysis.entityTypes).toContain('Order');
      expect(analysis.patterns.some(p => p.type === 'dbcontext')).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'dbset')).toBe(true);
    });

    it('should detect Include and ThenInclude', () => {
      const content = `
public async Task<Order> GetOrderWithDetails(int id)
{
    return await _context.Orders
        .Include(o => o.Customer)
        .ThenInclude(c => c.Address)
        .Include(o => o.Items)
        .FirstOrDefaultAsync(o => o.Id == id);
}
`;
      const analysis = detector.analyzeEfCore(content, 'OrderRepository.cs');
      
      expect(analysis.queryMethods).toContain('Include');
      expect(analysis.queryMethods).toContain('ThenInclude');
      expect(analysis.patterns.some(p => p.type === 'include')).toBe(true);
    });

    it('should detect AsNoTracking', () => {
      const content = `
public async Task<List<Product>> GetAllProducts()
{
    return await _context.Products
        .AsNoTracking()
        .ToListAsync();
}
`;
      const analysis = detector.analyzeEfCore(content, 'ProductRepository.cs');
      
      expect(analysis.usesNoTracking).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'no-tracking')).toBe(true);
    });

    it('should detect raw SQL and flag interpolation as security risk', () => {
      const content = `
public async Task<List<User>> SearchUsers(string name)
{
    // BAD: SQL injection risk
    return await _context.Users
        .FromSqlRaw($"SELECT * FROM Users WHERE Name LIKE '%{name}%'")
        .ToListAsync();
}
`;
      const analysis = detector.analyzeEfCore(content, 'UserRepository.cs');
      
      expect(analysis.usesRawSql).toBe(true);
      expect(analysis.securityConcerns.length).toBeGreaterThan(0);
      expect(analysis.securityConcerns[0]).toContain('SQL injection');
    });

    it('should detect FromSqlInterpolated as safe', () => {
      const content = `
public async Task<List<User>> SearchUsers(string name)
{
    // GOOD: Parameterized
    return await _context.Users
        .FromSqlInterpolated($"SELECT * FROM Users WHERE Name = {name}")
        .ToListAsync();
}
`;
      const analysis = detector.analyzeEfCore(content, 'UserRepository.cs');
      
      expect(analysis.usesRawSql).toBe(true);
      expect(analysis.securityConcerns).toHaveLength(0);
    });

    it('should detect SaveChanges patterns', () => {
      const content = `
public async Task<User> CreateUser(User user)
{
    _context.Users.Add(user);
    await _context.SaveChangesAsync();
    return user;
}
`;
      const analysis = detector.analyzeEfCore(content, 'UserRepository.cs');
      
      expect(analysis.patterns.some(p => p.type === 'save-changes')).toBe(true);
    });

    it('should detect transaction patterns', () => {
      const content = `
public async Task TransferFunds(int fromId, int toId, decimal amount)
{
    using var transaction = await _context.Database.BeginTransactionAsync();
    try
    {
        // Transfer logic
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
}
`;
      const analysis = detector.analyzeEfCore(content, 'AccountService.cs');
      
      expect(analysis.patterns.some(p => p.type === 'transaction')).toBe(true);
    });
  });

  describe('detect', () => {
    it('should create violations for SQL injection risks', async () => {
      const context = {
        content: `
public async Task<List<User>> Search(string term)
{
    return await _context.Users
        .FromSqlRaw($"SELECT * FROM Users WHERE Name = '{term}'")
        .ToListAsync();
}
`,
        file: 'UserRepository.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]?.message).toContain('SQL Injection');
    });
  });

  describe('metadata', () => {
    it('should have correct detector metadata', () => {
      expect(detector.id).toBe('data-access/efcore-patterns');
      expect(detector.category).toBe('data-access');
      expect(detector.supportedLanguages).toContain('csharp');
    });
  });
});
