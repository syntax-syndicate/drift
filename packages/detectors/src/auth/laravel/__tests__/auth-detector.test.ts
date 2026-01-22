/**
 * Laravel Auth Detector Tests
 */

import { describe, it, expect } from 'vitest';
import { LaravelAuthDetector } from '../auth-detector.js';

describe('LaravelAuthDetector', () => {
  const detector = new LaravelAuthDetector();

  describe('detect', () => {
    it('should detect Gate definitions', async () => {
      const content = `
        use Illuminate\\Support\\Facades\\Gate;

        Gate::define('update-post', function (User $user, Post $post) {
            return $user->id === $post->user_id;
        });
      `;

      const result = await detector.detect({
        content,
        file: 'app/Providers/AuthServiceProvider.php',
        language: 'php',
      });

      const laravelAuth = result.metadata?.custom?.laravelAuth as { gates: { definitions: unknown[] } } | undefined;
      expect(laravelAuth).toBeDefined();
      expect(laravelAuth?.gates.definitions).toHaveLength(1);
    });

    it('should detect Policy classes', async () => {
      const content = `
        namespace App\\Policies;

        class PostPolicy
        {
            public function update(User $user, Post $post): bool
            {
                return $user->id === $post->user_id;
            }
        }
      `;

      const result = await detector.detect({
        content,
        file: 'app/Policies/PostPolicy.php',
        language: 'php',
      });

      const laravelAuth = result.metadata?.custom?.laravelAuth as { policies: { policies: unknown[] } } | undefined;
      expect(laravelAuth?.policies.policies).toHaveLength(1);
    });

    it('should detect middleware', async () => {
      const content = `
        namespace App\\Http\\Middleware;

        class EnsureUserIsAdmin
        {
            public function handle(Request $request, Closure $next)
            {
                if (!$request->user()->isAdmin()) {
                    abort(403);
                }
                return $next($request);
            }
        }
      `;

      const result = await detector.detect({
        content,
        file: 'app/Http/Middleware/EnsureUserIsAdmin.php',
        language: 'php',
      });

      const laravelAuth = result.metadata?.custom?.laravelAuth as { middleware: { middlewares: unknown[] } } | undefined;
      expect(laravelAuth?.middleware.middlewares).toHaveLength(1);
    });

    it('should return empty for non-auth code', async () => {
      const content = `
        class User extends Model
        {
            protected $fillable = ['name'];
        }
      `;

      const result = await detector.detect({
        content,
        file: 'app/Models/User.php',
        language: 'php',
      });

      expect(result.patterns).toHaveLength(0);
    });
  });

  describe('analyzeAuth', () => {
    it('should analyze auth patterns', () => {
      const content = `
        Gate::define('view-post', fn($user, $post) => true);
        $this->authorize('update', $post);
      `;

      const result = detector.analyzeAuth(content, 'test.php');

      expect(result.gates.definitions).toHaveLength(1);
      expect(result.policies.authorizeCalls).toHaveLength(1);
    });
  });

  describe('metadata', () => {
    it('should have correct detector metadata', () => {
      expect(detector.id).toBe('auth/laravel-auth');
      expect(detector.category).toBe('auth');
      expect(detector.supportedLanguages).toContain('php');
    });
  });
});
