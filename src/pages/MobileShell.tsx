import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router";
import HomeScreen from "./HomeScreen";
import CashInScreen from "./CashInScreen";
import SendScreen from "./SendScreen";
import HistoryScreen from "./HistoryScreen";
import ProfileScreen from "./ProfileScreen";
import { Home, PlusCircle, Send, Clock, User, ClockAlert, LogOut } from "lucide-react";

const tabs = [
  { key: "home", label: "Home", icon: Home },
  { key: "cashin", label: "Cash In", icon: PlusCircle },
  { key: "send", label: "Send", icon: Send },
  { key: "history", label: "History", icon: Clock },
  { key: "profile", label: "Me", icon: User },
];

function PendingScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-[#F2F5F8] flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 shadow-sm flex flex-col items-center max-w-xs w-full">
        <div className="w-16 h-16 rounded-full bg-[#E8F1FE] flex items-center justify-center mb-4">
          <ClockAlert className="w-8 h-8 text-[#F5A623]" />
        </div>
        <h2 className="text-lg font-semibold text-[#1A1A2E] mb-2">Account Pending Approval</h2>
        <p className="text-sm text-[#6B7280] text-center mb-1">
          Your registration has been submitted and is being reviewed by our admin team.
        </p>
        <p className="text-xs text-[#9CA3AF] text-center mb-6">
          You will be able to access all wallet features once your account is approved.
        </p>
        <div className="w-full h-2 bg-[#F2F5F8] rounded-full mb-4">
          <div className="h-full bg-[#F5A623] rounded-full animate-pulse" style={{ width: "60%" }} />
        </div>
        <p className="text-[11px] text-[#9CA3AF] mb-6">Status: Pending Admin Review</p>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-sm text-[#E53935] hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>
    </div>
  );
}

export default function MobileShell() {
  const { isLoading, isAuthenticated, isPending, isActive, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("home");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F5F8] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#005CE5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Show pending approval screen
  if (isPending) {
    return (
      <div className="min-h-screen bg-[#F2F5F8] max-w-md mx-auto">
        <PendingScreen onLogout={logout} />
      </div>
    );
  }

  // Only ACTIVE users get the full app
  if (!isActive) {
    return (
      <div className="min-h-screen bg-[#F2F5F8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-xs">
          <p className="text-[#E53935] font-semibold mb-2">Account Suspended</p>
          <p className="text-sm text-[#6B7280]">Please contact support for assistance.</p>
          <button onClick={logout} className="text-sm text-[#E53935] mt-4">Log Out</button>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case "home": return <HomeScreen />;
      case "cashin": return <CashInScreen />;
      case "send": return <SendScreen />;
      case "history": return <HistoryScreen />;
      case "profile": return <ProfileScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F5F8] flex flex-col max-w-md mx-auto relative">
      <main className="flex-1 pb-20 overflow-y-auto">
        {renderScreen()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#F3F4F6] z-50">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActiveTab = activeTab === tab.key;
            const isSendTab = tab.key === "send";
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex flex-col items-center gap-0.5 py-1 px-3 relative"
              >
                <Icon
                  className={`w-6 h-6 transition-colors ${
                    isActiveTab ? "text-[#005CE5]" : "text-[#9CA3AF]"
                  } ${isSendTab ? "w-7 h-7" : ""}`}
                  style={isSendTab ? { transform: "translateY(-2px)" } : {}}
                />
                <span className={`text-[10px] font-medium ${
                  isActiveTab ? "text-[#005CE5]" : "text-[#9CA3AF]"
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
