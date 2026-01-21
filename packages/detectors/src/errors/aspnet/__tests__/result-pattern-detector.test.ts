/**
 * Tests for Result Pattern Detector
 */

import { describe, it, expect } from 'vitest';
import { ResultPatternDetector } from '../result-pattern-detector.js';

describe('ResultPatternDetector', () => {
  const detector = new ResultPatternDetector();

  describe('analyzeResultPattern', () => {
    it('should detect Result<T> type', () => {
      const content = `
public async Task<Result<User>> GetUserAsync(int id)
{
    var user = await _repository.GetByIdAsync(id);
    if (user == null)
        return Result<User>.Failure("User not found");
    return Result<User>.Success(user);
}
`;
      const analysis = detector.analyzeResultPattern(content, 'UserService.cs');
      
      expect(analysis.resultTypes).toContain('Result');
      expect(analysis.usesFunctionalErrors).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'result-type')).toBe(true);
    });

    it('should detect OneOf<T1, T2>', () => {
      const content = `
using OneOf;

public OneOf<User, NotFound, ValidationError> GetUser(int id)
{
    if (id <= 0)
        return new ValidationError("Invalid ID");
    
    var user = _repository.GetById(id);
    if (user == null)
        return new NotFound();
    
    return user;
}
`;
      const analysis = detector.analyzeResultPattern(content, 'UserService.cs');
      
      expect(analysis.resultTypes).toContain('OneOf');
      expect(analysis.libraries).toContain('OneOf');
      expect(analysis.patterns.some(p => p.type === 'oneof')).toBe(true);
    });

    it('should detect ErrorOr<T>', () => {
      const content = `
using ErrorOr;

public ErrorOr<User> CreateUser(CreateUserRequest request)
{
    if (string.IsNullOrEmpty(request.Email))
        return Error.Validation("Email is required");
    
    var user = new User { Email = request.Email };
    return user;
}
`;
      const analysis = detector.analyzeResultPattern(content, 'UserService.cs');
      
      expect(analysis.resultTypes).toContain('ErrorOr');
      expect(analysis.libraries).toContain('ErrorOr');
      expect(analysis.patterns.some(p => p.type === 'error-or')).toBe(true);
    });

    it('should detect Either<TLeft, TRight>', () => {
      const content = `
using LanguageExt;

public Either<Error, User> GetUser(int id)
{
    var user = _repository.GetById(id);
    if (user == null)
        return new Error("User not found");
    return user;
}
`;
      const analysis = detector.analyzeResultPattern(content, 'UserService.cs');
      
      expect(analysis.resultTypes).toContain('Either');
      expect(analysis.libraries).toContain('LanguageExt');
      expect(analysis.patterns.some(p => p.type === 'either')).toBe(true);
    });

    it('should detect Maybe<T> / Option<T>', () => {
      const content = `
public Maybe<User> FindUser(string email)
{
    var user = _repository.FindByEmail(email);
    return user != null ? Maybe<User>.Some(user) : Maybe<User>.None;
}

public Option<Product> GetProduct(int id)
{
    var product = _repository.GetById(id);
    return product != null ? Option<Product>.Some(product) : Option<Product>.None;
}
`;
      const analysis = detector.analyzeResultPattern(content, 'Services.cs');
      
      expect(analysis.resultTypes).toContain('Maybe');
      expect(analysis.resultTypes).toContain('Option');
      expect(analysis.patterns.some(p => p.type === 'maybe')).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'option')).toBe(true);
    });

    it('should detect FluentResults library', () => {
      const content = `
using FluentResults;

public Result<User> CreateUser(string email)
{
    if (string.IsNullOrEmpty(email))
        return Result.Fail<User>("Email is required");
    
    var user = new User { Email = email };
    return Result.Ok(user);
}
`;
      const analysis = detector.analyzeResultPattern(content, 'UserService.cs');
      
      expect(analysis.libraries).toContain('FluentResults');
    });
  });

  describe('detect', () => {
    it('should return patterns for result pattern files', async () => {
      const context = {
        content: `
public Result<Order> ProcessOrder(OrderRequest request)
{
    if (!request.IsValid)
        return Result<Order>.Failure("Invalid order");
    return Result<Order>.Success(new Order());
}
`,
        file: 'OrderService.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should return empty result for non-result pattern files', async () => {
      const context = {
        content: `
public class Calculator
{
    public int Add(int a, int b) => a + b;
}
`,
        file: 'Calculator.cs',
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
      expect(detector.id).toBe('errors/result-pattern');
      expect(detector.category).toBe('errors');
      expect(detector.supportedLanguages).toContain('csharp');
    });
  });
});
