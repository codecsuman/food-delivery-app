import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserStore } from "@/store/useUserStore";
import { Loader2, LockKeyholeIcon } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState<string>("");
  // FIXED: loading was hardcoded to false and never reflected the actual
  // request state. Now pulled from the store.
  const { loading, resetPassword } = useUserStore();
  const navigate = useNavigate();
  // FIXED: the route is /reset-password/:token, but this component never
  // read the token — there was no way to call resetPassword(token, ...)
  // with a real value. Pulled from useParams() to match the route.
  const { token } = useParams();

  const changeEventHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value);
  };

  // FIXED: the form had no onSubmit handler at all, and the Button
  // defaulted to type="submit" inside a <form> — clicking it triggered a
  // native browser form submission (full page reload) instead of calling
  // the API. resetPassword() from the store was never invoked, so the
  // feature did nothing.
  const resetPasswordSubmitHandler = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    await resetPassword(token, newPassword);
    navigate("/login");
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <form
        onSubmit={resetPasswordSubmitHandler}
        className="flex flex-col gap-5 md:p-8 w-full max-w-md rounded-lg mx-4"
      >
        <div className="text-center">
          <h1 className="font-extrabold text-2xl mb-2">Reset Password</h1>
          <p className="text-sm text-gray-600">Enter your new password to reset old one</p>
        </div>
        <div className="relative w-full">
            <Input
            type="password"
            value={newPassword}
            onChange={changeEventHandler}
            placeholder="Enter your new password"
            className="pl-10"
            />
            <LockKeyholeIcon className="absolute inset-y-2 left-2 text-gray-600 pointer-events-none"/>
        </div>
        {
            loading ? (
                <Button disabled className="bg-orange hover:bg-hoverOrange"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Please wait</Button>
            ) : (
                <Button type="submit" className="bg-orange hover:bg-hoverOrange">Reset Password</Button>
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

export default ResetPassword;