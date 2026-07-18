import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserStore } from "@/store/useUserStore";
import { Loader2, Mail } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  const [email, setEmail] = useState<string>("");
  // FIXED: loading was hardcoded to false and never reflected the actual
  // request state. Now pulled from the store, same as every other auth page.
  const { loading, forgotPassword } = useUserStore();

  const changeEventHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  // FIXED: the form had no onSubmit handler at all, and the Button
  // defaulted to type="submit" inside a <form> — clicking it triggered a
  // native browser form submission (full page reload) instead of calling
  // the API. forgotPassword() from the store was never invoked, so the
  // feature did nothing. Added the handler and wired it up.
  const forgotPasswordSubmitHandler = async (e: FormEvent) => {
    e.preventDefault();
    await forgotPassword(email);
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <form
        onSubmit={forgotPasswordSubmitHandler}
        className="flex flex-col gap-5 md:p-8 w-full max-w-md rounded-lg mx-4"
      >
        <div className="text-center">
          <h1 className="font-extrabold text-2xl mb-2">Forgot Password</h1>
          <p className="text-sm text-gray-600">Enter your email address to reset your password</p>
        </div>
        <div className="relative w-full">
            <Input
            type="text"
            value={email}
            onChange={changeEventHandler}
            placeholder="Enter your email"
            className="pl-10"
            />
            <Mail className="absolute inset-y-2 left-2 text-gray-600 pointer-events-none"/>
        </div>
        {
            loading ? (
                <Button disabled className="bg-orange hover:bg-hoverOrange"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Please wait</Button>
            ) : (
                <Button type="submit" className="bg-orange hover:bg-hoverOrange">Send Reset Link</Button>
            )
        }
        <span className="text-center">
            Back to{" "}
            <Link to="/login" className="text-blue-500">Login</Link>
        </span>
      </form>
    </div>
  );
};

export default ForgotPassword;