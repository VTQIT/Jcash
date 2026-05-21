import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Search, Receipt, ArrowDownLeft, ArrowUpRight, Send } from "lucide-react";

const filters = ["All", "Cash In", "Cash Out", "Send", "Receive"];

export default function HistoryScreen() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const typeFilter = activeFilter === "All" ? undefined : activeFilter.replace(" ", "_");
  const { data: txs, isLoading } = trpc.wallet.transactions.useQuery(
    { limit: 50, type: typeFilter },
  );

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 24 * 60 * 60 * 1000 && now.getDate() === d.getDate()) return "Today";
    if (diff < 48 * 60 * 60 * 1000 && now.getDate() - d.getDate() === 1) return "Yesterday";
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  };

  const getTxIcon = (type: string) => {
    switch (type) {
      case "CASH_IN":
      case "RECEIVE":
        return <ArrowDownLeft className="w-4 h-4 text-[#00C853]" />;
      case "CASH_OUT":
      case "SEND":
        return <ArrowUpRight className="w-4 h-4 text-[#E53935]" />;
      default:
        return <Send className="w-4 h-4 text-[#6B7280]" />;
    }
  };

  const getTxColor = (type: string) => {
    switch (type) {
      case "CASH_IN":
      case "RECEIVE":
        return "text-[#00C853]";
      case "CASH_OUT":
      case "SEND":
        return "text-[#E53935]";
      default:
        return "text-[#1A1A2E]";
    }
  };

  const filteredTxs = txs?.filter((tx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(q) ||
      tx.transactionRef?.toLowerCase().includes(q) ||
      tx.type?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#F2F5F8]">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-[#F3F4F6]">
        <h1 className="text-lg font-semibold text-[#1A1A2E]">Activity</h1>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilter === filter
                ? "bg-[#005CE5] text-white"
                : "bg-[#F2F5F8] text-[#6B7280]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="flex items-center h-10 bg-white rounded-lg px-3 border border-[#E5E7EB]">
          <Search className="w-4 h-4 text-[#9CA3AF] mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions"
            className="flex-1 text-sm outline-none text-[#1A1A2E]"
          />
        </div>
      </div>

      {/* Transaction List */}
      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#005CE5] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !filteredTxs || filteredTxs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-[#9CA3AF]">
            <Receipt className="w-12 h-12 mb-3" />
            <span className="text-sm">No transactions found</span>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredTxs.map((tx) => (
              <button
                key={tx.id}
                className="w-full flex items-center justify-between py-3 px-3 bg-white rounded-lg mb-2 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F2F5F8] flex items-center justify-center">
                    {getTxIcon(tx.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1A2E]">
                      {tx.description || tx.type.replace("_", " ")}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">{formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${getTxColor(tx.type)}`}>
                    {tx.type === "CASH_IN" || tx.type === "RECEIVE" ? "+" : "-"}
                    {"\u20B1"}{tx.amount}
                  </p>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      tx.status === "POSTED" || tx.status === "SETTLED"
                        ? "bg-green-50 text-[#00C853]"
                        : tx.status === "PENDING"
                        ? "bg-amber-50 text-[#F5A623]"
                        : "bg-red-50 text-[#E53935]"
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
