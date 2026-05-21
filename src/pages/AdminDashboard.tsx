import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  Wallet,
  TrendingUp,
  UserCheck,
  ScrollText,
  ArrowLeft,
  Lock,
  Unlock,
  RotateCcw,
  RefreshCw,
  LogOut,
  ShieldCheck,
  ShieldX,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminTab = "dashboard" | "approvals" | "kyc" | "users" | "transactions" | "ledger" | "limits";

const sidebarItems: { key: AdminTab; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "approvals", label: "Approvals", icon: UserCog },
  { key: "kyc", label: "KYC Queue", icon: UserCheck },
  { key: "users", label: "Users", icon: Users },
  { key: "transactions", label: "Transactions", icon: TrendingUp },
  { key: "ledger", label: "Ledger Explorer", icon: ScrollText },
  { key: "limits", label: "Limits", icon: Wallet },
];

export default function AdminDashboard() {
  const { isAdmin, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [reversalTxId, setReversalTxId] = useState("");
  const [reversalReason, setReversalReason] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#005CE5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0A1628] flex">
      {/* Sidebar */}
      <aside className="w-52 bg-[#0A1628] border-r border-white/10 flex flex-col fixed h-full">
        <div className="p-4 flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/70 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold text-sm">PayLite Admin</span>
        </div>
        <nav className="flex-1 px-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors mb-1 ${
                  activeTab === item.key
                    ? "bg-[#005CE5] text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-white/50 hover:text-white text-sm"
          >
            <LogOut className="w-4 h-4" />
            Exit Admin
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-52 p-6 overflow-y-auto">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "approvals" && <ApprovalsTab />}
        {activeTab === "kyc" && <KycTab onSelectUser={setSelectedUserId} selectedUserId={selectedUserId} />}
        {activeTab === "users" && <UsersTab onSelectUser={setSelectedUserId} selectedUserId={selectedUserId} />}
        {activeTab === "transactions" && (
          <TransactionsTab
            reversalTxId={reversalTxId}
            setReversalTxId={setReversalTxId}
            reversalReason={reversalReason}
            setReversalReason={setReversalReason}
          />
        )}
        {activeTab === "ledger" && <LedgerTab />}
        {activeTab === "limits" && <LimitsTab />}
      </main>
    </div>
  );
}

/* ─── Dashboard Tab ─── */
function DashboardTab() {
  const { data: stats, isLoading } = trpc.admin.dashboardStats.useQuery();

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-400" },
    { label: "Active Wallets", value: stats?.activeWallets || 0, icon: Wallet, color: "text-green-400" },
    { label: "Pending Approvals", value: stats?.pendingUsers || 0, icon: UserCog, color: "text-amber-400" },
    { label: "Pending KYC", value: stats?.pendingKyc || 0, icon: UserCheck, color: "text-yellow-400" },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white/5 rounded-xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/50 text-xs">{card.label}</span>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-white text-2xl font-bold">
                {isLoading ? "-" : card.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Today's Volume */}
      <div className="mt-6 bg-white/5 rounded-xl p-5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          <span className="text-white/50 text-xs">Today&apos;s Transaction Volume</span>
        </div>
        <span className="text-white text-3xl font-bold">
          {"\u20B1"}{parseFloat(stats?.todayVolume || "0").toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/* ─── Approvals Tab (NEW) ─── */
function ApprovalsTab() {
  const { data: pendingUsers, isLoading } = trpc.admin.pendingUsers.useQuery();
  const utils = trpc.useUtils();

  const approveMutation = trpc.admin.approveUser.useMutation({
    onSuccess: (data) => {
      toast.success(`User ${data.status === "ACTIVE" ? "approved" : "rejected"} successfully`);
      utils.admin.pendingUsers.invalidate();
      utils.admin.dashboardStats.invalidate();
      utils.admin.users.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-2">Pending Approvals</h1>
      <p className="text-white/40 text-sm mb-6">Review and approve new user registrations</p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#005CE5] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !pendingUsers || pendingUsers.length === 0 ? (
        <div className="bg-white/5 rounded-xl p-8 border border-white/10 text-center">
          <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-white/60 text-sm">No pending approvals. All caught up!</p>
        </div>
      ) : (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Name</th>
                <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Phone</th>
                <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Registered</th>
                <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white text-sm font-medium">{u.fullName || "-"}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{u.phoneNumber}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveMutation.mutate({ userId: u.id, action: "APPROVE" })}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                        disabled={approveMutation.isPending}
                      >
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => approveMutation.mutate({ userId: u.id, action: "REJECT" })}
                        size="sm"
                        variant="outline"
                        className="border-red-500 text-red-400 hover:bg-red-500/10 h-7 text-xs"
                        disabled={approveMutation.isPending}
                      >
                        <ShieldX className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── KYC Tab ─── */
function KycTab({ onSelectUser, selectedUserId }: { onSelectUser: (id: number | null) => void; selectedUserId: number | null }) {
  const { data: queue } = trpc.admin.kycQueue.useQuery();
  const { data: detail } = trpc.admin.kycDetail.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const utils = trpc.useUtils();

  const reviewMutation = trpc.admin.reviewKyc.useMutation({
    onSuccess: () => {
      toast.success("KYC review submitted");
      utils.admin.kycQueue.invalidate();
      onSelectUser(null);
    },
  });

  if (selectedUserId && detail) {
    return (
      <div>
        <button onClick={() => onSelectUser(null)} className="text-white/50 text-sm mb-4 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to queue
        </button>
        <h2 className="text-lg font-semibold text-white mb-4">KYC Review</h2>
        <div className="bg-white/5 rounded-xl p-5 border border-white/10 max-w-lg">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-white/50">Name</span><span className="text-white">{detail.fullName || "-"}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Phone</span><span className="text-white">{detail.phoneNumber}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Nationality</span><span className="text-white">{detail.nationality || "-"}</span></div>
            <div className="flex justify-between"><span className="text-white/50">ID Type</span><span className="text-white">{detail.idType || "-"}</span></div>
            <div className="flex justify-between"><span className="text-white/50">ID Number</span><span className="text-white">{detail.idNumber || "-"}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Address</span><span className="text-white">{detail.homeAddress || "-"}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Source of Funds</span><span className="text-white">{detail.sourceOfFunds || "-"}</span></div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button
              onClick={() => reviewMutation.mutate({ userId: selectedUserId, decision: "APPROVE", level: 2 })}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={reviewMutation.isPending}
            >
              Approve
            </Button>
            <Button
              onClick={() => reviewMutation.mutate({ userId: selectedUserId, decision: "REJECT", rejectionReason: "Documents unclear" })}
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={reviewMutation.isPending}
            >
              Reject
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">KYC Verification Queue</h1>
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">User</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Submitted</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">ID Type</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Status</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue?.map((item) => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-white text-sm">{item.fullName || item.phoneNumber}</td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  {item.kycSubmittedAt ? new Date(item.kycSubmittedAt).toLocaleDateString() : "-"}
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">{item.idType || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    item.kycStatus === "PENDING" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {item.kycStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onSelectUser(item.id)} className="text-[#005CE5] text-xs hover:underline">
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Users Tab ─── */
function UsersTab({ onSelectUser, selectedUserId }: { onSelectUser: (id: number | null) => void; selectedUserId: number | null }) {
  const { data: users } = trpc.admin.users.useQuery();
  const { data: userDetail } = trpc.admin.userDetail.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const utils = trpc.useUtils();

  const freezeMutation = trpc.admin.freezeWallet.useMutation({
    onSuccess: () => {
      toast.success("Wallet frozen");
      utils.admin.users.invalidate();
    },
  });
  const unfreezeMutation = trpc.admin.unfreezeWallet.useMutation({
    onSuccess: () => {
      toast.success("Wallet unfrozen");
      utils.admin.users.invalidate();
    },
  });

  if (selectedUserId && userDetail) {
    return (
      <div>
        <button onClick={() => onSelectUser(null)} className="text-white/50 text-sm mb-4 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h2 className="text-lg font-semibold text-white mb-4">User Detail</h2>
        <div className="bg-white/5 rounded-xl p-5 border border-white/10 max-w-lg space-y-3">
          <div className="flex justify-between text-sm"><span className="text-white/50">Name</span><span className="text-white">{userDetail.fullName || "-"}</span></div>
          <div className="flex justify-between text-sm"><span className="text-white/50">Phone</span><span className="text-white">{userDetail.phoneNumber}</span></div>
          <div className="flex justify-between text-sm"><span className="text-white/50">KYC Level</span><span className="text-white">{userDetail.kycLevel}</span></div>
          <div className="flex justify-between text-sm"><span className="text-white/50">Role</span><span className="text-white">{userDetail.role}</span></div>
          <div className="flex justify-between text-sm"><span className="text-white/50">Wallet</span><span className="text-white">{userDetail.wallet?.walletNumber || "-"}</span></div>
          <div className="flex justify-between text-sm"><span className="text-white/50">Balance</span><span className="text-white">{"\u20B1"}{userDetail.wallet?.balance || "0.00"}</span></div>
          <div className="flex justify-between text-sm"><span className="text-white/50">Status</span>
            <span className={userDetail.wallet?.status === "ACTIVE" ? "text-green-400" : "text-red-400"}>
              {userDetail.wallet?.status || "N/A"}
            </span>
          </div>
          <div className="flex justify-between text-sm"><span className="text-white/50">Account</span>
            <span className={
              userDetail.status === "ACTIVE" ? "text-green-400" :
              userDetail.status === "PENDING" ? "text-amber-400" : "text-red-400"
            }>
              {userDetail.status}
            </span>
          </div>
          {userDetail.wallet && (
            <div className="flex gap-3 mt-4">
              {userDetail.wallet.status === "ACTIVE" ? (
                <Button
                  onClick={() => freezeMutation.mutate({ walletId: userDetail.wallet!.id, reason: "Admin action" })}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={freezeMutation.isPending}
                >
                  <Lock className="w-4 h-4 mr-1" /> Freeze Wallet
                </Button>
              ) : (
                <Button
                  onClick={() => unfreezeMutation.mutate({ walletId: userDetail.wallet!.id })}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={unfreezeMutation.isPending}
                >
                  <Unlock className="w-4 h-4 mr-1" /> Unfreeze Wallet
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">User Management</h1>
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Name</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Phone</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Level</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Status</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-white text-sm">{u.fullName || u.phoneNumber}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{u.phoneNumber}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{u.kycLevel}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.status === "ACTIVE" ? "bg-green-500/20 text-green-400" :
                    u.status === "PENDING" ? "bg-amber-500/20 text-amber-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onSelectUser(u.id)} className="text-[#005CE5] text-xs hover:underline">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Transactions Tab ─── */
function TransactionsTab({
  reversalTxId, setReversalTxId,
  reversalReason, setReversalReason,
}: {
  reversalTxId: string; setReversalTxId: (v: string) => void;
  reversalReason: string; setReversalReason: (v: string) => void;
}) {
  const { data: txs } = trpc.admin.transactions.useQuery();
  const utils = trpc.useUtils();

  const reverseMutation = trpc.admin.reverseTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaction reversed");
      setReversalTxId("");
      setReversalReason("");
      utils.admin.transactions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Transaction Monitor</h1>

      <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">Reversal Tool</h3>
        <div className="flex gap-3">
          <input
            type="number"
            value={reversalTxId}
            onChange={(e) => setReversalTxId(e.target.value)}
            placeholder="Transaction ID"
            className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
          />
          <input
            type="text"
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
            placeholder="Reason"
            className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
          />
          <Button
            onClick={() => {
              if (!reversalTxId || !reversalReason) {
                toast.error("Enter transaction ID and reason");
                return;
              }
              reverseMutation.mutate({ transactionId: parseInt(reversalTxId), reason: reversalReason });
            }}
            disabled={reverseMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reverse
          </Button>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Ref</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Type</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Amount</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Status</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {txs?.map((tx) => (
              <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-white/70 text-xs">{tx.transactionRef}</td>
                <td className="px-4 py-3 text-white text-sm">{tx.type}</td>
                <td className="px-4 py-3 text-white text-sm">{"\u20B1"}{tx.amount}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    tx.status === "POSTED" || tx.status === "SETTLED" ? "bg-green-500/20 text-green-400" :
                    tx.status === "PENDING" ? "bg-amber-500/20 text-amber-400" :
                    tx.status === "REVERSED" ? "bg-purple-500/20 text-purple-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Ledger Tab ─── */
function LedgerTab() {
  const { data: entries } = trpc.admin.ledgerExplorer.useQuery();
  const { data: reconResults } = trpc.admin.reconciliation.useQuery();
  const utils = trpc.useUtils();

  const runReconMutation = trpc.admin.runReconciliation.useMutation({
    onSuccess: () => {
      toast.success("Reconciliation complete");
      utils.admin.reconciliation.invalidate();
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Ledger Explorer</h1>
        <Button onClick={() => runReconMutation.mutate()} disabled={runReconMutation.isPending} className="bg-[#005CE5] hover:bg-[#004BBF]">
          <RefreshCw className="w-4 h-4 mr-1" />
          Run Reconciliation
        </Button>
      </div>

      {reconResults && reconResults.length > 0 && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
          <h3 className="text-sm font-semibold text-white mb-3">Reconciliation Status</h3>
          <div className="space-y-2">
            {reconResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-white/50">{r.walletNumber}</span>
                <div className="flex items-center gap-4">
                  <span className="text-white/50">Ledger: {"\u20B1"}{r.ledgerBalance}</span>
                  <span className="text-white/50">Cache: {"\u20B1"}{r.cachedBalance}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === "MATCHED" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">TX Ref</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Wallet</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Type</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Amount</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {entries?.map((entry) => (
              <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-white/70 text-xs">{entry.transactionRef}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{entry.walletId}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    entry.entryType === "CREDIT" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {entry.entryType}
                  </span>
                </td>
                <td className="px-4 py-3 text-white text-sm">{"\u20B1"}{entry.amount}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{"\u20B1"}{entry.runningBalance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Limits Tab ─── */
function LimitsTab() {
  const { data: limits } = trpc.admin.limits.useQuery();
  const utils = trpc.useUtils();

  const updateMutation = trpc.admin.updateLimits.useMutation({
    onSuccess: () => {
      toast.success("Limits updated");
      utils.admin.limits.invalidate();
    },
  });

  const [editing, setEditing] = useState<Record<number, { dailyTransferCap: string; dailyCashOutCap: string; maxTransactionAmount: string; monthlyCap: string }>>({});

  const handleEdit = (level: number, field: string, value: string) => {
    setEditing((prev) => ({
      ...prev,
      [level]: { ...prev[level], [field]: value },
    }));
  };

  const handleSave = (level: number) => {
    const data = editing[level];
    if (!data) return;
    updateMutation.mutate({
      kycLevel: level,
      dailyTransferCap: data.dailyTransferCap,
      dailyCashOutCap: data.dailyCashOutCap,
      maxTransactionAmount: data.maxTransactionAmount,
      monthlyCap: data.monthlyCap,
    });
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Limits Management</h1>
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Tier</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Daily Transfer</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Daily Cash-Out</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Max Transaction</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Monthly Cap</th>
              <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {limits?.map((limit) => (
              <tr key={limit.id} className="border-b border-white/5">
                <td className="px-4 py-3 text-white text-sm font-medium">Level {limit.kycLevel}</td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={limit.dailyTransferCap}
                    onChange={(e) => handleEdit(limit.kycLevel, "dailyTransferCap", e.target.value)}
                    className="bg-white/10 rounded px-2 py-1 text-white text-xs w-28 outline-none"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={limit.dailyCashOutCap}
                    onChange={(e) => handleEdit(limit.kycLevel, "dailyCashOutCap", e.target.value)}
                    className="bg-white/10 rounded px-2 py-1 text-white text-xs w-28 outline-none"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={limit.maxTransactionAmount}
                    onChange={(e) => handleEdit(limit.kycLevel, "maxTransactionAmount", e.target.value)}
                    className="bg-white/10 rounded px-2 py-1 text-white text-xs w-28 outline-none"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={limit.monthlyCap}
                    onChange={(e) => handleEdit(limit.kycLevel, "monthlyCap", e.target.value)}
                    className="bg-white/10 rounded px-2 py-1 text-white text-xs w-28 outline-none"
                  />
                </td>
                <td className="px-4 py-3">
                  <Button
                    onClick={() => handleSave(limit.kycLevel)}
                    size="sm"
                    className="bg-[#005CE5] hover:bg-[#004BBF] h-7 text-xs"
                  >
                    Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
