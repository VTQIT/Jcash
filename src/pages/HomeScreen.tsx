import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import {
  Receipt,
  Smartphone,
  Building2,
  QrCode,
  Wallet,
  CreditCard,
  Grid3x3,
  Shield,
  ChevronDown,
  ArrowRightLeft,
  PlusCircle,
  Send,
} from "lucide-react";

const quickActions = [
  { icon: Receipt, label: "Pay Bills" },
  { icon: Smartphone, label: "Buy Load" },
  { icon: Building2, label: "Bank Transfer" },
  { icon: QrCode, label: "QR Pay" },
  { icon: Wallet, label: "Savings" },
  { icon: CreditCard, label: "Cards" },
  { icon: Grid3x3, label: "More" },
];

const promos = [
  { title: "Cashback Rewards", subtitle: "Get up to 5% back", bg: "from-[#005CE5] to-[#7B2FF7]" },
  { title: "Bills Payment Promo", subtitle: "Free fee this month", bg: "from-[#F5A623] to-[#FFD93D]" },
  { title: "Send Money Free", subtitle: "No fee on first 3 sends", bg: "from-[#00C853] to-[#00E676]" },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { data: balance } = trpc.wallet.balance.useQuery();
  const { data: recentTxs } = trpc.wallet.transactions.useQuery({ limit: 5 });
  const [showBalance, setShowBalance] = useState(true);
  const [animatedBalance, setAnimatedBalance] = useState(0);
  const [activePromo, setActivePromo] = useState(0);

  const actualBalance = parseFloat(balance?.available || "0");

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedBalance(actualBalance * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [actualBalance]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActivePromo((prev) => (prev + 1) % promos.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex flex-col">
      {/* Balance Header */}
      <div className="bg-[#005CE5] px-4 pt-6 pb-5 rounded-b-3xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {(user?.fullName || "U").charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-white/80 text-sm">
            {greeting()}, {user?.fullName?.split(" ")[0] || "User"}
          </span>
        </div>

        <div className="mb-1">
          <span className="text-white/60 text-xs">Available Balance</span>
        </div>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="text-left"
        >
          <span className="text-white text-3xl font-bold">
            {showBalance ? formatCurrency(animatedBalance) : "\u20B1••••••"}
          </span>
        </button>

        <div className="flex items-center gap-2 mt-1 mb-4">
          <span className="text-white/40 text-xs">
            Available Limit: {"\u20B1"}100,000
          </span>
        </div>

        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 bg-white text-[#005CE5] px-4 py-1.5 rounded-full text-xs font-semibold">
            <PlusCircle className="w-3.5 h-3.5" />
            Cash In
          </button>
          <button className="flex items-center gap-1.5 bg-white text-[#005CE5] px-4 py-1.5 rounded-full text-xs font-semibold">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Transfer
          </button>
          <button className="flex items-center gap-1.5 bg-white/20 text-white px-4 py-1.5 rounded-full text-xs font-semibold">
            <ChevronDown className="w-3.5 h-3.5" />
            More
          </button>
        </div>

        <div className="flex items-center gap-1 mt-3">
          <Shield className="w-3 h-3 text-white/50" />
          <span className="text-white/40 text-[10px]">Encrypted & Secure</span>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="mx-4 mt-4 bg-white rounded-xl p-4">
        <div className="grid grid-cols-4 gap-0">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={i}
                className="flex flex-col items-center justify-center py-3 gap-1.5 active:scale-95 transition-transform"
              >
                <Icon className="w-7 h-7 text-[#005CE5]" />
                <span className="text-[11px] text-[#1A1A2E] font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Promo Carousel */}
      <div className="mx-4 mt-4">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
          {promos.map((promo, i) => (
            <div
              key={i}
              className={`flex-shrink-0 w-[280px] h-[120px] rounded-xl bg-gradient-to-r ${promo.bg} snap-start p-4 flex flex-col justify-center`}
            >
              <span className="text-white text-base font-semibold">{promo.title}</span>
              <span className="text-white/80 text-xs mt-1">{promo.subtitle}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-1.5 mt-2">
          {promos.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === activePromo ? "bg-[#005CE5]" : "bg-[#E5E7EB]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mx-4 mt-4 bg-white rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Recent Activity</h3>
          <button className="text-xs text-[#005CE5] font-medium">View All</button>
        </div>

        {(!recentTxs || recentTxs.length === 0) ? (
          <div className="flex flex-col items-center py-6 text-[#9CA3AF]">
            <Receipt className="w-10 h-10 mb-2" />
            <span className="text-sm">No transactions yet</span>
          </div>
        ) : (
          <div className="space-y-0">
            {recentTxs.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    tx.type === "CASH_IN" || tx.type === "RECEIVE"
                      ? "bg-green-50"
                      : "bg-red-50"
                  }`}>
                    {tx.type === "CASH_IN" || tx.type === "RECEIVE" ? (
                      <PlusCircle className="w-4 h-4 text-[#00C853]" />
                    ) : (
                      <Send className="w-4 h-4 text-[#E53935]" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1A2E]">{tx.description || tx.type}</p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    tx.type === "CASH_IN" || tx.type === "RECEIVE"
                      ? "text-[#00C853]"
                      : "text-[#E53935]"
                  }`}
                >
                  {tx.type === "CASH_IN" || tx.type === "RECEIVE" ? "+" : "-"}
                  {"\u20B1"}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
