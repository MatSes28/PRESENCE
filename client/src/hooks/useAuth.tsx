import {
  useState,
  useEffect,
  useContext,
  createContext,
  ReactNode,
  useRef,
} from "react";
import { api } from "../lib/api";
import { connectWebSocket, disconnectWebSocket } from "../lib/websocket";
import type { ApiResponse, LoginResult } from "../lib/apiTypes";

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_SESSION_MARKER = "presence.authenticated";
const isAuthDebugEnabled = () =>
  localStorage.getItem("presence.debugAuth") === "true";

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

type AuthResponse = ApiResponse<LoginResult> & {
  user?: User;
};

const isUserLike = (value: unknown): value is User => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<User>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.email === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.role === "string"
  );
};

const getUserFromAuthResponse = (response: AuthResponse): User | undefined => {
  const dataUser = response.data?.user;
  if (isUserLike(dataUser)) return dataUser;
  if (isUserLike(response.data)) return response.data;
  return response.user;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authCheckStarted = useRef(false);

  useEffect(() => {
    if (authCheckStarted.current) {
      return;
    }

    authCheckStarted.current = true;
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    if (localStorage.getItem(AUTH_SESSION_MARKER) !== "true") {
      setLoading(false);
      return;
    }

    try {
      const response = await api.getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data as User);
        // Connect to WebSocket with user ID
        await connectWebSocket((response.data as User).id);
      }
    } catch (err) {
      localStorage.removeItem(AUTH_SESSION_MARKER);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      setLoading(true);

      const response = await api.login(email, password);

      const userData = getUserFromAuthResponse(response);
      if (response.success && userData) {
        localStorage.setItem(AUTH_SESSION_MARKER, "true");
        setUser(userData);
        // Connect to WebSocket with user ID
        await connectWebSocket(userData.id);
        if (isAuthDebugEnabled()) {
          console.debug("Login successful", { userId: userData.id });
        }
        return true;
      } else {
        if (isAuthDebugEnabled()) {
          console.debug("Login failed", { message: response.message });
        }
        setError(response.message || "Login failed");
        return false;
      }
    } catch (err) {
      console.error("Login error caught:", err);
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
      localStorage.removeItem(AUTH_SESSION_MARKER);
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
