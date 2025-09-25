'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthContextType, AuthResponse } from '../types/auth';
import { createApiUrl, getBasePath } from './utils';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking auth status...');
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('No access token found');
        setIsLoading(false);
        return;
      }

      console.log('🔑 Token found, verifying...');
      // Verify token and get user info
      const response = await fetch(createApiUrl('/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Token verified, user:', data.user);
        setUser(data.user);
      } else {
        console.log('Token verification failed');
        // Token is invalid, clear it
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Client-side route protection
  useEffect(() => {
    const handleRouteChange = () => {
      const token = localStorage.getItem('access_token');
      const { pathname } = window.location;
      
      // Public routes that don't require authentication
      const publicRoutes = [`${getBasePath()}/auth/login`];
      const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
      
      console.log('🔍 Route check:', {
        pathname,
        token: !!token,
        isPublicRoute,
        publicRoutes
      });
      
      // !Special handling for register page - need to add the register page to the public routes above
      // if (pathname.startsWith(`${getBasePath()}/auth/register`)) {
      //   console.log('Register page detected, allowing access');
      //   return;
      // }
      
      // If accessing a public route and user is authenticated, redirect to dashboard
      if (isPublicRoute && token) {
        console.log('Redirecting authenticated user from public route to dashboard');
        window.location.href = `${getBasePath()}/`;
        return;
      }
      
      // If accessing a protected route and user is not authenticated, redirect to login
      if (!isPublicRoute && !token && pathname !== '/') {
        console.log('Redirecting unauthenticated user from protected route to login'); 
        window.location.href = `${getBasePath()}/auth/login`;
        return;
      }
    };

    // Check route on mount
    handleRouteChange();
    
    // Listen for route changes
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  const login = async (username: string, password: string): Promise<AuthResponse> => {
    try {
      console.log('🔐 Attempting login for user:', username);
      const response = await fetch(createApiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log('📡 Login response:', data);

      if (data.success) {
        console.log('Login successful, storing tokens...');
        // Store tokens
        localStorage.setItem('access_token', data.tokens.access_token);
        localStorage.setItem('refresh_token', data.tokens.refresh_token);
        
        // Set user
        setUser(data.user);
        console.log('User set:', data.user);
      } else {
        console.log('Login failed:', data.message);
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Network error occurred'
      };
    }
  };

  const register = async (username: string, email: string, password: string, confirmPassword: string): Promise<AuthResponse> => {
    try {
      console.log('📝 Attempting registration for user:', username);
      const response = await fetch(createApiUrl('/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, confirmPassword }),
      });

      const data = await response.json();
      console.log('Registration response:', data);

      if (data.success) {
        console.log('Registration successful for user:', data.user?.username);
      } else {
        console.log('Registration failed:', data.message);
      }

      return data;
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Network error occurred'
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('access_token');
      
      if (token) {
        await fetch(createApiUrl('/auth/logout'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_token: token }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(createApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        return true;
      } else {
        // Refresh token is invalid, logout
        await logout();
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 