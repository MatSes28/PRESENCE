import { useState, useCallback } from "react";

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

interface FieldConfig {
  [key: string]: ValidationRule;
}

interface ValidationErrors {
  [key: string]: string;
}

export const useFormValidation = (config: FieldConfig) => {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const validateField = useCallback(
    (name: string, value: string): string | null => {
      const rules = config[name];
      if (!rules) return null;

      // Required validation
      if (rules.required && (!value || value.trim() === "")) {
        return `${name.charAt(0).toUpperCase() + name.slice(1)} is required`;
      }

      // Skip other validations if field is empty and not required
      if (!value && !rules.required) return null;

      // Min length validation
      if (rules.minLength && value.length < rules.minLength) {
        return `${
          name.charAt(0).toUpperCase() + name.slice(1)
        } must be at least ${rules.minLength} characters`;
      }

      // Max length validation
      if (rules.maxLength && value.length > rules.maxLength) {
        return `${
          name.charAt(0).toUpperCase() + name.slice(1)
        } must be no more than ${rules.maxLength} characters`;
      }

      // Pattern validation
      if (rules.pattern && !rules.pattern.test(value)) {
        return `${
          name.charAt(0).toUpperCase() + name.slice(1)
        } format is invalid`;
      }

      // Custom validation
      if (rules.custom) {
        return rules.custom(value);
      }

      return null;
    },
    [config]
  );

  const validateForm = useCallback(
    (data: { [key: string]: string }): boolean => {
      const newErrors: ValidationErrors = {};
      let isValid = true;

      Object.keys(config).forEach((fieldName) => {
        const error = validateField(fieldName, data[fieldName] || "");
        if (error) {
          newErrors[fieldName] = error;
          isValid = false;
        }
      });

      setErrors(newErrors);
      return isValid;
    },
    [config, validateField]
  );

  const validateSingleField = useCallback(
    (name: string, value: string) => {
      const error = validateField(name, value);
      setErrors((prev) => ({
        ...prev,
        [name]: error || "",
      }));
      return !error;
    },
    [validateField]
  );

  const setFieldTouched = useCallback((name: string) => {
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const getFieldError = useCallback(
    (name: string): string | null => {
      return touched[name] ? errors[name] || null : null;
    },
    [errors, touched]
  );

  return {
    errors,
    touched,
    validateForm,
    validateSingleField,
    setFieldTouched,
    getFieldError,
    clearErrors,
    isValid: Object.keys(errors).length === 0,
  };
};

// Common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  studentId: /^[A-Z0-9]{8,12}$/,
};

// Common validation rules
export const commonValidationRules = {
  email: {
    required: true,
    pattern: validationPatterns.email,
    custom: (value: string) => {
      if (!validationPatterns.email.test(value)) {
        return "Please enter a valid email address";
      }
      return null;
    },
  },
  password: {
    required: true,
    minLength: 8,
    custom: (value: string) => {
      if (!validationPatterns.password.test(value)) {
        return "Password must contain at least 8 characters with uppercase, lowercase, and number";
      }
      return null;
    },
  },
  confirmPassword: (passwordField: string) => ({
    required: true,
    custom: (value: string) => {
      const passwordValue = (
        document.querySelector(`[name="${passwordField}"]`) as HTMLInputElement
      )?.value;
      if (value !== passwordValue) {
        return "Passwords do not match";
      }
      return null;
    },
  }),
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
  },
  studentId: {
    required: true,
    pattern: validationPatterns.studentId,
    custom: (value: string) => {
      if (!validationPatterns.studentId.test(value)) {
        return "Student ID must be 8-12 alphanumeric characters";
      }
      return null;
    },
  },
};
