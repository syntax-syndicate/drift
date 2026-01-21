/**
 * Tests for Repository Pattern Detector
 */

import { describe, it, expect } from 'vitest';
import { RepositoryPatternDetector } from '../repository-pattern-detector.js';

describe('RepositoryPatternDetector', () => {
  const detector = new RepositoryPatternDetector();

  describe('analyzeRepositoryPattern', () => {
    it('should detect generic repository interface', () => {
      const content = `
public interface IRepository<T> where T : class
{
    Task<T> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(T entity);
}
`;
      const analysis = detector.analyzeRepositoryPattern(content, 'IRepository.cs');
      
      expect(analysis.interfaces).toContain('IRepository');
      expect(analysis.patterns.some(p => p.type === 'repository-interface')).toBe(true);
    });

    it('should detect specific repository interface', () => {
      const content = `
public interface IUserRepository : IRepository<User>
{
    Task<User> GetByEmailAsync(string email);
    Task<IEnumerable<User>> GetActiveUsersAsync();
}
`;
      const analysis = detector.analyzeRepositoryPattern(content, 'IUserRepository.cs');
      
      expect(analysis.interfaces.length).toBeGreaterThan(0);
    });

    it('should detect repository implementation', () => {
      const content = `
public class UserRepository : IUserRepository
{
    private readonly ApplicationDbContext _context;

    public UserRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<User> GetByIdAsync(int id)
    {
        return await _context.Users.FindAsync(id);
    }
}
`;
      const analysis = detector.analyzeRepositoryPattern(content, 'UserRepository.cs');
      
      expect(analysis.implementations).toContain('UserRepository');
    });

    it('should detect generic repository implementation', () => {
      const content = `
public class Repository<T> : IRepository<T> where T : class
{
    protected readonly DbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(DbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public virtual async Task<T> GetByIdAsync(int id)
    {
        return await _dbSet.FindAsync(id);
    }
}
`;
      const analysis = detector.analyzeRepositoryPattern(content, 'Repository.cs');
      
      expect(analysis.patterns.some(p => p.type === 'generic-repository')).toBe(true);
    });

    it('should detect Unit of Work pattern', () => {
      const content = `
public interface IUnitOfWork : IDisposable
{
    IUserRepository Users { get; }
    IOrderRepository Orders { get; }
    Task<int> SaveChangesAsync();
}

public class UnitOfWork : IUnitOfWork
{
    private readonly ApplicationDbContext _context;

    public IUserRepository Users { get; }
    public IOrderRepository Orders { get; }

    public async Task<int> SaveChangesAsync()
    {
        return await _context.SaveChangesAsync();
    }
}
`;
      const analysis = detector.analyzeRepositoryPattern(content, 'UnitOfWork.cs');
      
      expect(analysis.usesUnitOfWork).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'unit-of-work')).toBe(true);
    });

    it('should detect Specification pattern', () => {
      const content = `
public interface ISpecification<T>
{
    Expression<Func<T, bool>> Criteria { get; }
    List<Expression<Func<T, object>>> Includes { get; }
}

public class ActiveUsersSpecification : ISpecification<User>
{
    public Expression<Func<User, bool>> Criteria => u => u.IsActive;
    public List<Expression<Func<User, object>>> Includes { get; } = new();
}
`;
      const analysis = detector.analyzeRepositoryPattern(content, 'Specifications.cs');
      
      expect(analysis.usesSpecification).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'specification')).toBe(true);
    });
  });

  describe('detect', () => {
    it('should return patterns for repository files', async () => {
      const context = {
        content: `
public interface IProductRepository : IRepository<Product>
{
    Task<IEnumerable<Product>> GetByCategoryAsync(int categoryId);
}
`,
        file: 'IProductRepository.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should return empty result for non-repository files', async () => {
      const context = {
        content: `
public class MathService
{
    public int Add(int a, int b) => a + b;
}
`,
        file: 'MathService.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.patterns).toHaveLength(0);
    });
  });

  describe('metadata', () => {
    it('should have correct detector metadata', () => {
      expect(detector.id).toBe('data-access/repository-pattern');
      expect(detector.category).toBe('data-access');
      expect(detector.supportedLanguages).toContain('csharp');
    });
  });
});
