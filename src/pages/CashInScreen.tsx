import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  Building2,
  Store,
  CreditCard,
  QrCode,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const methods = [
  { icon: Building2, label: "Online Bank Transfer", desc: "BDO, BPI, Metrobank, UnionBank" },
  { icon: Store, label: "Over-the-Counter", desc: "7-Eleven, Cebuana, MLhuillier" },
  { icon: CreditCard, label: "Debit Card", desc: "Visa, Mastercard, JCB" },
  { icon: QrCode, label: "Generate QR Code", desc: "Share to receive payment" },
];

export default function CashInScreen() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const utils = trpc.useUtils();
  const cashInMutation = trpc.wallet.cashIn.useMutation({
    onSuccess: () => {
      toast.success("Cash-in successful!");
      utils.wallet.balance.invalidate();
      utils.wallet.transactions.invalidate();
      setAmount("");
      setSelectedMethod(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleCashIn = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    cashInMutation.mutate({
      amount,
      method: selectedMethod || "Bank Transfer",
    });
  };

  return (
    <div className="min-h-screen bg-[#F2F5F8]">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-[#F3F4F6]">
        <h1 className="text-lg font-semibold text-[#1A1A2E]">Cash In</h1>
      </div>

      <div className="p-4">
        <h2 className="text-base font-semibold text-[#1A1A2E]">Add Money</h2>
        <p className="text-xs text-[#6B7280] mt-1">Choose a cash-in method</p>

        {/* Methods List */}
        <div className="bg-white rounded-xl mt-4 overflow-hidden">
          {methods.map((method, i) => {
            const Icon = method.icon;
            return (
              <button
                key={i}
                onClick={() => setSelectedMethod(method.label)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                  selectedMethod === method.label ? "bg-[#E8F1FE]" : ""
                } ${i < methods.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}
              >
                <Icon className="w-5 h-5 text-[#005CE5]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1A1A2E]">{method.label}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{method.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
              </button>
            );
          })}
        </div>

        {/* Amount Input */}
        {selectedMethod && (
          <div className="mt-4 bg-white rounded-xl p-5">
            <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
              Amount
            </label>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl text-[#1A1A2E] font-semibold">{"\u20B1"}</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-3xl font-bold text-[#1A1A2E] outline-none w-full bg-transparent"
              />
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-2">
              Convenience fee may apply
            </p>
          </div>
        )}

        {selectedMethod && (
          <Button
            onClick={handleCashIn}
            disabled={cashInMutation.isPending}
            className="w-full h-14 mt-4 bg-[#005CE5] hover:bg-[#004BBF] text-white font-semibold rounded-xl"
          >
            {cashInMutation.isPending ? "Processing..." : "Cash In"}
          </Button>
        )}
      </div>
    </div>
  );
}
