import {
  useState,
  useEffect,
  useContext,
  createContext,
  ReactNode,
} from "react";
import { api } from "../lib/api";
import { connectWebSocket, disconnectWebSocket } from "../lib/websocket";

interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "faculty";
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

interface LoginResponse {
  user: User;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await api.getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data as User);
        // Connect to WebSocket with user ID
        await connectWebSocket((response.data as User).id);
      }
    } catch (err) {
      // User not authenticated, that's okay
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      setLoading(true);

      const response = await api.login(email, password);

      if (response.success && response.data) {
        setUser(response.data as User);
        // Connect to WebSocket with user ID
        await connectWebSocket((response.data as User).id);
        return true;
      } else {
        setError(response.message || "Login failed");
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      disconnectWebSocket();
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    loading,
    error,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
