import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Wallet, UserPlus, LogIn } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("paylite_token", data.token);
      setIsLoading(false);
      if (data.pending) {
        // User is pending approval - show message but still set token
        // so the app shell can show the pending screen
        window.location.href = "/";
      } else {
        window.location.href = "/";
      }
    },
    onError: (err) => {
      setError(err.message);
      setIsLoading(false);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setSuccessMsg(data.message);
      setIsLoading(false);
      // Switch to login after 2 seconds
      setTimeout(() => {
        setMode("login");
        setSuccessMsg("");
        setPassword("");
      }, 2000);
    },
    onError: (err) => {
      setError(err.message);
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    const formattedPhone = phone.startsWith("+") ? phone : `+63${phone}`;
    setIsLoading(true);

    if (mode === "login") {
      loginMutation.mutate({ phoneNumber: formattedPhone, password });
    } else {
      if (!fullName.trim()) {
        setError("Please enter your full name");
        setIsLoading(false);
        return;
      }
      registerMutation.mutate({
        phoneNumber: formattedPhone,
        password,
        fullName: fullName.trim(),
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F5F8] flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-full bg-[#005CE5] flex items-center justify-center mb-4">
          <Wallet className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-[#1A1A2E]">PayLite</h1>
        <p className="text-sm text-[#6B7280] mt-1">Mobile Wallet</p>
      </div>

      {/* Mode Toggle */}
      <div className="w-full max-w-sm flex mb-4 bg-white rounded-lg p-1">
        <button
          onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-colors ${
            mode === "login" ? "bg-[#005CE5] text-white" : "text-[#6B7280]"
          }`}
        >
          <LogIn className="w-4 h-4" />
          Log In
        </button>
        <button
          onClick={() => { setMode("register"); setError(""); setSuccessMsg(""); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-colors ${
            mode === "register" ? "bg-[#005CE5] text-white" : "text-[#6B7280]"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Register
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl p-5 shadow-sm">
        {mode === "register" && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setError(""); }}
              placeholder="Juan Dela Cruz"
              className="w-full h-12 bg-[#F2F5F8] rounded-lg px-4 mt-1 text-base outline-none text-[#1A1A2E]"
            />
          </div>
        )}

        <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
          Mobile Number
        </label>
        <div className="flex items-center h-12 bg-[#F2F5F8] rounded-lg px-4 mt-1">
          <span className="text-[#6B7280] text-base mr-2">+63</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            placeholder="9XX XXX XXXX"
            className="flex-1 bg-transparent text-base outline-none text-[#1A1A2E]"
            maxLength={10}
          />
        </div>

        <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide block mt-3">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          placeholder={mode === "register" ? "Min 6 characters" : "Enter password"}
          className="w-full h-12 bg-[#F2F5F8] rounded-lg px-4 mt-1 text-base outline-none text-[#1A1A2E]"
          minLength={6}
        />

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        {successMsg && <p className="text-xs text-green-600 mt-2">{successMsg}</p>}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-14 mt-5 bg-[#005CE5] hover:bg-[#004BBF] text-white font-semibold rounded-xl"
        >
          {isLoading
            ? mode === "login" ? "Logging in..." : "Registering..."
            : mode === "login" ? "Log In" : "Register"}
        </Button>
      </form>

      {mode === "register" && (
        <p className="text-xs text-[#9CA3AF] text-center mt-4 max-w-xs">
          After registration, your account will be reviewed by an admin before you can access the wallet.
        </p>
      )}

      <p className="text-xs text-[#9CA3AF] text-center mt-auto pt-8">
        By using PayLite, you agree to our Terms and Privacy Policy
      </p>
    </div>
  );
}
