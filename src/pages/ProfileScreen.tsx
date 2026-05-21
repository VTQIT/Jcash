import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import {
  User,
  Shield,
  Bell,
  HelpCircle,
  FileText,
  ChevronRight,
  LogOut,
  Crown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfileScreen() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", "", "", ""]);
  const [pinStep, setPinStep] = useState<"set" | "confirm">("set");

  const { data: kycData } = trpc.kyc.status.useQuery(undefined, {
    enabled: !!user,
  });

  const setPinMutation = trpc.auth.setPin.useMutation({
    onSuccess: () => {
      toast.success("PIN set successfully!");
      setShowPinSetup(false);
      setPin(["", "", "", "", "", ""]);
      setConfirmPin(["", "", "", "", ""]);
      setPinStep("set");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handlePinChange = (index: number, value: string, isConfirm: boolean) => {
    if (value.length > 1) return;
    const target = isConfirm ? confirmPin : pin;
    const setter = isConfirm ? setConfirmPin : setPin;
    const newPin = [...target];
    newPin[index] = value;
    setter(newPin);
    if (value && index < 5) {
      const prefix = isConfirm ? "confirm" : "set";
      document.getElementById(`profile-${prefix}-pin-${index + 1}`)?.focus();
    }
    if (value && index === 5) {
      if (!isConfirm) {
        setPinStep("confirm");
      } else {
        const confirmCode = [...confirmPin.slice(0, 5), value].join("");
        if (pin.join("") === confirmCode) {
          setPinMutation.mutate({ pin: confirmCode });
        } else {
          toast.error("PINs do not match");
          setPin(["", "", "", "", "", ""]);
          setConfirmPin(["", "", "", "", "", ""]);
          setPinStep("set");
        }
      }
    }
  };

  const menuItems = [
    { icon: User, label: "Personal Information", action: () => {} },
    { icon: Shield, label: "Security & Privacy", action: () => setShowPinSetup(true) },
    { icon: Bell, label: "Notifications", action: () => {} },
    { icon: HelpCircle, label: "Help Center", action: () => {} },
    { icon: FileText, label: "Terms & Privacy", action: () => {} },
  ];

  if (showPinSetup) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex flex-col items-center justify-center p-6">
        <h2 className="text-white text-lg font-semibold mb-2">
          {pinStep === "set" ? "Set your PIN" : "Confirm your PIN"}
        </h2>
        <p className="text-white/50 text-xs mb-6">
          {pinStep === "set" ? "Create a 6-digit PIN" : "Re-enter your PIN to confirm"}
        </p>
        <div className="flex gap-3">
          {(pinStep === "set" ? pin : confirmPin).map((digit, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                digit ? "bg-[#005CE5]" : "bg-white/20"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          {(pinStep === "set" ? pin : confirmPin).map((digit, i) => (
            <input
              key={i}
              id={`profile-${pinStep}-pin-${i}`}
              type="password"
              inputMode="numeric"
              value={digit}
              onChange={(e) => handlePinChange(i, e.target.value, pinStep === "confirm")}
              className="w-12 h-14 bg-white/10 rounded-lg text-center text-xl text-white outline-none focus:ring-2 focus:ring-[#005CE5]"
              maxLength={1}
            />
          ))}
        </div>
        <button
          onClick={() => {
            setShowPinSetup(false);
            setPin(["", "", "", "", "", ""]);
            setConfirmPin(["", "", "", "", "", ""]);
            setPinStep("set");
          }}
          className="text-white/50 text-sm mt-6"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F5F8]">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#005CE5] to-[#004BBF] px-4 pt-6 pb-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-white border-[3px] border-white/30 flex items-center justify-center mb-2">
          <span className="text-[#005CE5] text-xl font-bold">
            {(user?.fullName || "U").charAt(0).toUpperCase()}
          </span>
        </div>
        <h2 className="text-white text-base font-semibold">{user?.fullName || "User"}</h2>
        <p className="text-white/60 text-xs">{user?.phoneNumber}</p>
      </div>

      {/* KYC Status */}
      <div className="mx-4 -mt-4 bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#005CE5]" />
            <span className="text-sm font-medium text-[#1A1A2E]">Account Level</span>
          </div>
          <div className="flex items-center gap-2">
            {kycData?.status === "APPROVED" ? (
              <>
                <Crown className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-xs font-semibold text-[#00C853]">
                  Level {kycData?.level} - Verified
                </span>
              </>
            ) : kycData?.status === "PENDING" ? (
              <span className="text-xs font-semibold text-[#F5A623]">Under Review</span>
            ) : (
              <span className="text-xs font-semibold text-[#E53935]">Unverified</span>
            )}
          </div>
        </div>
        {kycData?.status !== "APPROVED" && (
          <button
            onClick={() => toast.info("KYC verification coming soon")}
            className="w-full mt-3 py-2 bg-[#E8F1FE] text-[#005CE5] text-xs font-semibold rounded-lg"
          >
            Upgrade Account
          </button>
        )}
      </div>

      {/* Menu List */}
      <div className="mx-4 mt-4 bg-white rounded-xl overflow-hidden">
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={item.action}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
                i < menuItems.length - 1 ? "border-b border-[#F3F4F6]" : ""
              }`}
            >
              <Icon className="w-5 h-5 text-[#6B7280]" />
              <span className="flex-1 text-sm text-[#1A1A2E]">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
            </button>
          );
        })}
      </div>

      {/* Admin Link */}
      {isAdmin && (
        <div className="mx-4 mt-4 bg-white rounded-xl overflow-hidden">
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
          >
            <TrendingUp className="w-5 h-5 text-[#005CE5]" />
            <span className="flex-1 text-sm text-[#005CE5] font-medium">Admin Dashboard</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
        </div>
      )}

      {/* Logout */}
      <div className="mx-4 mt-4 mb-6">
        <Button
          onClick={logout}
          variant="outline"
          className="w-full h-12 border-[#E53935] text-[#E53935] hover:bg-red-50 rounded-xl font-semibold"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );
}
