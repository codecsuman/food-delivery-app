import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { LoginInputState, userLoginSchema } from "@/schema/userSchema";
import { useUserStore } from "@/store/useUserStore";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const Login = () => {
  const [input, setInput] = useState<LoginInputState>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<LoginInputState>>({});
const { loading, login } = useUserStore();
  const navigate = useNavigate();

  const changeEventHandler = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInput((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name as keyof LoginInputState]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const loginSubmitHandler = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validate with Zod
    const result = userLoginSchema.safeParse(input);
    if (!result.success) {
      const fieldErrors = result.error.formErrors.fieldErrors;
      setErrors(fieldErrors as Partial<LoginInputState>);
      return;
    }

    // Clear previous errors
    setErrors({});

    // Call login
    await login(input);

    // Check if login succeeded using store state directly
    // This is more reliable than the previous approach
    setTimeout(() => {
      if (useUserStore.getState().isAuthenticated) {
        navigate("/");
      }
    }, 100);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
      <form
        onSubmit={loginSubmitHandler}
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
      >
        {/* Logo / Brand */}
        <div className="mb-6 text-center">
          <h1 className="font-bold text-3xl text-orange-500">Suman Food</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Welcome back! Please login.</p>
        </div>

        {/* Email Input */}
        <div className="mb-4">
          <div className="relative">
            <Input
              type="email"
              placeholder="Email"
              name="email"
              value={input.email}
              onChange={changeEventHandler}
              className="pl-10 h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus-visible:ring-orange-500"
            />
            <Mail className="absolute inset-y-3 left-3 text-gray-400 w-5 h-5 pointer-events-none" />
          </div>
          {errors.email && (
            <span className="text-xs text-red-500 mt-1 block">{errors.email}</span>
          )}
        </div>

        {/* Password Input */}
        <div className="mb-6">
          <div className="relative">
            <Input
              type="password"
              placeholder="Password"
              name="password"
              value={input.password}
              onChange={changeEventHandler}
              className="pl-10 h-12 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus-visible:ring-orange-500"
            />
            <LockKeyhole className="absolute inset-y-3 left-3 text-gray-400 w-5 h-5 pointer-events-none" />
          </div>
          {errors.password && (
            <span className="text-xs text-red-500 mt-1 block">{errors.password}</span>
          )}
        </div>

        {/* Submit Button */}
        <div className="mb-4">
          {loading ? (
            <Button disabled className="w-full h-12 bg-orange-500 hover:bg-orange-600">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait
            </Button>
          ) : (
            <Button
              type="submit"
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            >
              Login
            </Button>
          )}
        </div>

        {/* Forgot Password */}
        <div className="mb-6 text-right">
          <Link
            to="/forgot-password"
            className="text-sm text-orange-500 hover:text-orange-600 hover:underline"
          >
            Forgot Password?
          </Link>
        </div>

        <Separator className="bg-gray-200 dark:bg-gray-700" />

        {/* Signup Link */}
        <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
          Don't have an account?{" "}
          <Link to="/signup" className="text-orange-500 hover:text-orange-600 font-semibold">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;