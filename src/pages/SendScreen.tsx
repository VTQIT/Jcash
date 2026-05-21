import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const savedRecipients = [
  { name: "Maria Santos", phone: "PL-9876-5432", initial: "M" },
  { name: "John Reyes", phone: "PL-5555-7777", initial: "J" },
  { name: "Ana Cruz", phone: "PL-3333-8888", initial: "A" },
];

const purposes = ["Payment", "Gift", "Allowance", "Others"];

export default function SendScreen() {
  const { user } = useAuth();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("Payment");
  const [message, setMessage] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [isSending, setIsSending] = useState(false);

  const utils = trpc.useUtils();
  const sendMutation = trpc.wallet.send.useMutation({
    onSuccess: () => {
      toast.success("Money sent successfully!");
      utils.wallet.balance.invalidate();
      utils.wallet.transactions.invalidate();
      setRecipient("");
      setAmount("");
      setMessage("");
      setShowPin(false);
      setPin(["", "", "", "", "", ""]);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSending(false);
    },
  });

  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 5) {
      document.getElementById(`send-pin-${index + 1}`)?.focus();
    }
    if (value && index === 5) {
      const pinCode = [...newPin.slice(0, 5), value].join("");
      handleSend(pinCode);
    }
  };

  const handleSend = (pinCode: string) => {
    if (!recipient || !amount) return;
    setIsSending(true);
    sendMutation.mutate({
      toWalletNumber: recipient,
      amount,
      pin: pinCode,
      purpose,
      description: message || undefined,
    });
  };

  const formatCurrency = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "\u20B10.00";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(num);
  };

  if (showPin) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex flex-col items-center justify-center p-6">
        <button
          onClick={() => setShowPin(false)}
          className="absolute top-4 left-4 text-white/60"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-white text-lg font-semibold mb-6">Enter your PIN</h2>
        <div className="flex gap-3 mb-8">
          {pin.map((digit, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${
                digit ? "bg-[#005CE5]" : "bg-white/20"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-3">
          {pin.map((digit, i) => (
            <input
              key={i}
              id={`send-pin-${i}`}
              type="password"
              inputMode="numeric"
              value={digit}
              onChange={(e) => handlePinChange(i, e.target.value)}
              className="w-12 h-14 bg-white/10 rounded-lg text-center text-xl text-white outline-none focus:ring-2 focus:ring-[#005CE5]"
              maxLength={1}
            />
          ))}
        </div>
        {isSending && (
          <p className="text-white/50 text-sm mt-6">Processing...</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F5F8]">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-[#F3F4F6]">
        <h1 className="text-lg font-semibold text-[#1A1A2E]">Send Money</h1>
      </div>

      <div className="p-4">
        {/* Recipient */}
        <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
          To:
        </label>
        <div className="flex items-center h-12 bg-white rounded-lg px-3 mt-1 border border-[#E5E7EB]">
          <Search className="w-4 h-4 text-[#9CA3AF] mr-2" />
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter wallet number (e.g. PL-XXXX-XXXX)"
            className="flex-1 text-sm outline-none text-[#1A1A2E]"
          />
        </div>

        {/* Saved Recipients */}
        <div className="flex gap-3 mt-3 overflow-x-auto pb-2">
          {savedRecipients.map((r, i) => (
            <button
              key={i}
              onClick={() => setRecipient(r.phone)}
              className="flex flex-col items-center gap-1 min-w-[60px]"
            >
              <div className="w-11 h-11 rounded-full bg-[#E8F1FE] flex items-center justify-center">
                <span className="text-[#005CE5] text-sm font-semibold">{r.initial}</span>
              </div>
              <span className="text-[10px] text-[#6B7280]">{r.name}</span>
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="bg-white rounded-xl p-5 mt-4">
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
          <p className="text-xs text-[#9CA3AF] mt-1">
            Available: {"\u20B1"}{user?.walletNumber ? "" : "0.00"}
          </p>
        </div>

        {/* Purpose */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {purposes.map((p) => (
            <button
              key={p}
              onClick={() => setPurpose(p)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                purpose === p
                  ? "bg-[#005CE5] text-white"
                  : "bg-white text-[#1A1A2E] border border-[#E5E7EB]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Message */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a message (optional)"
          className="w-full h-20 bg-white rounded-lg p-3 text-sm outline-none mt-4 resize-none border border-[#E5E7EB]"
        />

        {/* Send Button */}
        <Button
          onClick={() => {
            if (!recipient || !amount || parseFloat(amount) <= 0) {
              toast.error("Please enter recipient and amount");
              return;
            }
            setShowPin(true);
          }}
          className="w-full h-14 mt-6 bg-[#005CE5] hover:bg-[#004BBF] text-white font-semibold rounded-xl"
        >
          Send {amount ? formatCurrency(amount) : ""}
        </Button>
      </div>
    </div>
  );
}
