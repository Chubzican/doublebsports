import { useState, useEffect, useCallback } from "react";

// ─── Persistent Storage Helpers ───────────────────────────────────────────────
const DB = {
  async get(key) {
    try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; } catch { return null; }
  },
  async set(key, val) {
    try { await window.storage.set(key, JSON.stringify(val), true); } catch {}
  }
};

// ─── Seed Data ────────────────────────────────────────────────────────────────
const SEED_MEMBERS = [
  { id: "owner", name: "Commissioner", role: "owner", balance: 10000, inviteCode: null, status: "active", joinedAt: Date.now() },
];

const GAMES = [
  { id: "g1", sport: "NBA", home: "Lakers", away: "Celtics", time: "7:30 PM ET", homeOdds: -110, awayOdds: -110, spread: 2.5, ou: 224.5, live: true, status: "open" },
  { id: "g2", sport: "NBA", home: "Warriors", away: "Bucks", time: "10:00 PM ET", homeOdds: 135, awayOdds: -160, spread: 3.5, ou: 231.0, live: false, status: "open" },
  { id: "g3", sport: "NFL", home: "Chiefs", away: "Eagles", time: "Sun 4:25 PM", homeOdds: -150, awayOdds: 125, spread: 3.0, ou: 47.5, live: false, status: "open" },
  { id: "g4", sport: "NFL", home: "49ers", away: "Cowboys", time: "Sun 8:20 PM", homeOdds: -120, awayOdds: 100, spread: 2.0, ou: 44.5, live: false, status: "open" },
  { id: "g5", sport: "MLB", home: "Yankees", away: "Red Sox", time: "1:05 PM ET", homeOdds: -175, awayOdds: 148, spread: null, ou: 9.5, live: true, status: "open" },
  { id: "g6", sport: "MLB", home: "Dodgers", away: "Giants", time: "4:10 PM ET", homeOdds: -195, awayOdds: 162, spread: null, ou: 7.5, live: false, status: "open" },
  { id: "g7", sport: "NHL", home: "Bruins", away: "Maple Leafs", time: "7:00 PM ET", homeOdds: 115, awayOdds: -135, spread: null, ou: 6.5, live: true, status: "open" },
  { id: "g8", sport: "NHL", home: "Avalanche", away: "Knights", time: "9:00 PM ET", homeOdds: -140, awayOdds: 118, spread: null, ou: 6.0, live: false, status: "open" },
  { id: "g9", sport: "MMA", home: "Jones, Jon", away: "Miocic, Stipe", time: "Sat 10 PM ET", homeOdds: -350, awayOdds: 275, spread: null, ou: null, live: false, status: "open" },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = (o) => (o > 0 ? `+${o}` : `${o}`);
const calcWin = (odds, stake) => odds > 0 ? +(stake * odds / 100).toFixed(2) : +(stake * 100 / Math.abs(odds)).toFixed(2);
const parlayMultiplier = (legs) => legs.reduce((acc, odds) => {
  const dec = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
  return acc * dec;
}, 1);
const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const sportIcon = { NBA: "🏀", NFL: "🏈", MLB: "⚾", NHL: "🏒", MMA: "🥊" };
const sports = ["NBA", "NFL", "MLB", "NHL", "MMA"];

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0A0E1A",
  surface: "#111827",
  card: "#1A2235",
  border: "#1F2D45",
  gold: "#F5B800",
  goldDim: "#F5B80025",
  blue: "#3B82F6",
  blueDim: "#3B82F615",
  red: "#EF4444",
  redDim: "#EF444420",
  green: "#22C55E",
  greenDim: "#22C55E20",
  text: "#E2E8F0",
  muted: "#64748B",
  white: "#FFFFFF",
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function DoubleBSports() {
  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState([]);
  const [wagers, setWagers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginName, setLoginName] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [view, setView] = useState("games"); // games | slip | leaderboard | history | admin
  const [sport, setSport] = useState("NBA");
  const [betSlip, setBetSlip] = useState([]);
  const [stakes, setStakes] = useState({});
  const [parlayMode, setParlayMode] = useState(false);
  const [parlayStake, setParlayStake] = useState("");
  const [toast, setToast] = useState(null);
  const [games, setGames] = useState(GAMES);
  const [adminTab, setAdminTab] = useState("members");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberBalance, setNewMemberBalance] = useState("1000");
  const [newMemberRole, setNewMemberRole] = useState("member");
  const [gradeTarget, setGradeTarget] = useState(null); // { wagerId, legIdx? }
  const [showInvite, setShowInvite] = useState(null);

  // Load from storage
  useEffect(() => {
    (async () => {
      const m = await DB.get("dbs_members");
      const w = await DB.get("dbs_wagers");
      if (m && m.length) setMembers(m);
      else { setMembers(SEED_MEMBERS); await DB.set("dbs_members", SEED_MEMBERS); }
      if (w) setWagers(w);
      setLoaded(true);
    })();
  }, []);

  // Persist
  useEffect(() => { if (loaded && members.length) DB.set("dbs_members", members); }, [members, loaded]);
  useEffect(() => { if (loaded) DB.set("dbs_wagers", wagers); }, [wagers, loaded]);

  // Odds drift for live games
  useEffect(() => {
    const t = setInterval(() => {
      setGames(g => g.map(game => !game.live ? game : {
        ...game,
        homeOdds: game.homeOdds + Math.floor((Math.random() - 0.5) * 6),
        awayOdds: game.awayOdds + Math.floor((Math.random() - 0.5) * 6),
      }));
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Auth ──
  const handleLogin = () => {
    if (loginName.trim().toLowerCase() === "commissioner" && loginCode === "") {
      const owner = members.find(m => m.role === "owner");
      if (owner) { setCurrentUser(owner); setLoginErr(""); return; }
    }
    const found = members.find(m =>
      m.name.toLowerCase() === loginName.trim().toLowerCase() &&
      m.status === "active" &&
      (m.role === "owner" || m.inviteCode === loginCode.trim().toUpperCase())
    );
    if (found) { setCurrentUser(found); setLoginErr(""); }
    else setLoginErr("Name or invite code not found.");
  };

  const logout = () => { setCurrentUser(null); setLoginName(""); setLoginCode(""); setBetSlip([]); setStakes({}); };

  const refreshUser = (updated) => {
    setCurrentUser(updated);
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  // ── Bet Slip ──
  const toggleLeg = (game, type, label, odds) => {
    const key = `${game.id}-${type}`;
    setBetSlip(prev => {
      if (prev.find(b => b.key === key)) return prev.filter(b => b.key !== key);
      if (parlayMode && prev.length >= 5) { showToast("Max 5 legs in a parlay", "error"); return prev; }
      return [...prev, { key, gameId: game.id, type, label, odds, home: game.home, away: game.away, sport: game.sport }];
    });
  };
  const isSelected = (gid, type) => betSlip.some(b => b.gameId === gid && b.type === type);
  const removeLeg = (key) => { setBetSlip(p => p.filter(b => b.key !== key)); setStakes(p => { const n = { ...p }; delete n[key]; return n; }); };

  const totalStraightStake = betSlip.reduce((s, b) => s + (parseFloat(stakes[b.key]) || 0), 0);
  const totalStraightReturn = betSlip.reduce((s, b) => { const st = parseFloat(stakes[b.key]) || 0; return s + st + calcWin(b.odds, st); }, 0);

  const parlayStakeNum = parseFloat(parlayStake) || 0;
  const parlayMult = betSlip.length > 1 ? parlayMultiplier(betSlip.map(b => b.odds)) : 0;
  const parlayReturn = parlayStakeNum > 0 && betSlip.length > 1 ? +(parlayStakeNum * parlayMult).toFixed(2) : 0;

  const placeBets = () => {
    if (!currentUser) return;
    if (parlayMode) {
      if (betSlip.length < 2) { showToast("Need at least 2 legs for a parlay", "error"); return; }
      if (parlayStakeNum <= 0) { showToast("Enter a stake", "error"); return; }
      if (parlayStakeNum > currentUser.balance) { showToast("Insufficient balance", "error"); return; }
      const wager = {
        id: `w-${Date.now()}`, memberId: currentUser.id, memberName: currentUser.name,
        type: "parlay", legs: betSlip.map(b => ({ ...b, result: "pending" })),
        stake: parlayStakeNum, potentialReturn: parlayReturn, result: "pending",
        placedAt: new Date().toLocaleString()
      };
      const updated = { ...currentUser, balance: +(currentUser.balance - parlayStakeNum).toFixed(2) };
      setWagers(p => [wager, ...p]);
      refreshUser(updated);
      setBetSlip([]); setStakes({}); setParlayStake(""); setParlayMode(false);
      showToast(`Parlay placed! ${betSlip.length} legs · $${parlayReturn.toFixed(2)} to win`);
    } else {
      const valid = betSlip.filter(b => (parseFloat(stakes[b.key]) || 0) > 0);
      if (!valid.length) { showToast("Enter a stake", "error"); return; }
      const totalStake = valid.reduce((s, b) => s + parseFloat(stakes[b.key]), 0);
      if (totalStake > currentUser.balance) { showToast("Insufficient balance", "error"); return; }
      const newWagers = valid.map(b => {
        const st = parseFloat(stakes[b.key]);
        return {
          id: `w-${Date.now()}-${b.key}`, memberId: currentUser.id, memberName: currentUser.name,
          type: "straight", leg: { ...b, result: "pending" },
          stake: st, potentialReturn: +(st + calcWin(b.odds, st)).toFixed(2),
          result: "pending", placedAt: new Date().toLocaleString()
        };
      });
      const updated = { ...currentUser, balance: +(currentUser.balance - totalStake).toFixed(2) };
      setWagers(p => [...newWagers, ...p]);
      refreshUser(updated);
      setBetSlip([]); setStakes({});
      showToast(`${valid.length} bet${valid.length > 1 ? "s" : ""} placed!`);
    }
    setView("history");
  };

  // ── Admin: grade wager ──
  const gradeWager = (wagerId, result, legKey = null) => {
    setWagers(prev => prev.map(w => {
      if (w.id !== wagerId) return w;
      if (w.type === "straight") {
        if (result === "pending") return { ...w, result: "pending", leg: { ...w.leg, result: "pending" } };
        const member = members.find(m => m.id === w.memberId);
        if (!member) return w;
        const payout = result === "win" ? w.potentialReturn : result === "push" ? w.stake : 0;
        const updated = { ...member, balance: +(member.balance + payout).toFixed(2) };
        setMembers(pm => pm.map(m => m.id === updated.id ? updated : m));
        if (currentUser?.id === updated.id) setCurrentUser(updated);
        return { ...w, result, leg: { ...w.leg, result } };
      } else {
        // parlay leg grading
        const legs = w.legs.map(l => l.key === legKey ? { ...l, result } : l);
        const allGraded = legs.every(l => l.result !== "pending");
        const anyLoss = legs.some(l => l.result === "loss");
        const anyPush = legs.some(l => l.result === "push");
        let parlayResult = "pending";
        let payout = 0;
        if (allGraded) {
          if (anyLoss) { parlayResult = "loss"; payout = 0; }
          else if (anyPush) { parlayResult = "push"; payout = w.stake; }
          else { parlayResult = "win"; payout = w.potentialReturn; }
          const member = members.find(m => m.id === w.memberId);
          if (member) {
            const updated = { ...member, balance: +(member.balance + payout).toFixed(2) };
            setMembers(pm => pm.map(m => m.id === updated.id ? updated : m));
            if (currentUser?.id === updated.id) setCurrentUser(updated);
          }
        }
        return { ...w, legs, result: parlayResult };
      }
    }));
    showToast("Wager graded");
  };

  // ── Admin: members ──
  const addMember = () => {
    if (!newMemberName.trim()) return;
    const code = genCode();
    const m = { id: `m-${Date.now()}`, name: newMemberName.trim(), role: newMemberRole, balance: parseFloat(newMemberBalance) || 1000, inviteCode: code, status: "active", joinedAt: Date.now() };
    setMembers(p => [...p, m]);
    setShowInvite({ name: m.name, code });
    setNewMemberName(""); setNewMemberBalance("1000"); setNewMemberRole("member");
  };
  const updateMemberBalance = (id, delta) => setMembers(p => p.map(m => m.id === id ? { ...m, balance: +(m.balance + delta).toFixed(2) } : m));
  const toggleMemberStatus = (id) => setMembers(p => p.map(m => m.id === id ? { ...m, status: m.status === "active" ? "suspended" : "active" } : m));
  const promoteRole = (id, role) => setMembers(p => p.map(m => m.id === id ? { ...m, role } : m));
  const resetCode = (id) => { const code = genCode(); setMembers(p => p.map(m => m.id === id ? { ...m, inviteCode: code } : m)); setShowInvite({ name: members.find(m => m.id === id)?.name, code }); };

  const canAdmin = currentUser?.role === "owner" || currentUser?.role === "mod";
  const myWagers = wagers.filter(w => w.memberId === currentUser?.id);
  const leaderboard = [...members].sort((a, b) => b.balance - a.balance);

  // ────────────────── RENDER ──────────────────────────────────────────────────
  if (!loaded) return <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, fontSize: 18, fontWeight: 700 }}>Loading Double B Sports…</div>;

  if (!currentUser) return <LoginScreen members={members} loginName={loginName} setLoginName={setLoginName} loginCode={loginCode} setLoginCode={setLoginCode} loginErr={loginErr} onLogin={handleLogin} />;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Inter','Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? C.red : C.green, color: "#fff", padding: "10px 20px", borderRadius: 8, fontWeight: 700, fontSize: 14, zIndex: 9999, whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, maxWidth: 340, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🎟️</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Invite Code for {showInvite.name}</div>
            <div style={{ background: C.bg, border: `2px dashed ${C.gold}`, borderRadius: 8, padding: "14px 0", fontSize: 28, fontWeight: 900, letterSpacing: 6, color: C.gold, margin: "16px 0" }}>{showInvite.code}</div>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Share this code with the member. They'll use their name + this code to log in.</div>
            <button onClick={() => setShowInvite(null)} style={btnStyle(C.gold, C.bg)}>Done</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-1px" }}>
            <span style={{ color: C.gold }}>DOUBLE B</span>
            <span style={{ color: C.text }}> SPORTS</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1 }}>{currentUser.name} · {currentUser.role}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.gold, fontVariantNumeric: "tabular-nums" }}>${currentUser.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
          <button onClick={logout} style={{ background: C.border, border: "none", color: C.muted, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Out</button>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", overflowX: "auto" }}>
        {[
          { id: "games", label: "🏟 Games" },
          { id: "slip", label: `🎯 Slip${betSlip.length ? ` (${betSlip.length})` : ""}` },
          { id: "leaderboard", label: "🏆 Board" },
          { id: "history", label: "📋 My Bets" },
          ...(canAdmin ? [{ id: "admin", label: "⚙️ Admin" }] : []),
        ].map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{ background: "none", border: "none", padding: "11px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700, color: view === n.id ? C.gold : C.muted, borderBottom: `2px solid ${view === n.id ? C.gold : "transparent"}`, whiteSpace: "nowrap", transition: "all 0.12s" }}>
            {n.label}
          </button>
        ))}
      </nav>

      {/* Body */}
      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "16px 12px" }}>

        {/* ── GAMES ── */}
        {view === "games" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
              {sports.map(s => (
                <button key={s} onClick={() => setSport(s)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${sport === s ? C.gold : C.border}`, background: sport === s ? C.goldDim : "transparent", color: sport === s ? C.gold : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {sportIcon[s]} {s}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {games.filter(g => g.sport === sport && g.status === "open").map(game => (
                <GameRow key={game.id} game={game} sport={sport} toggleLeg={toggleLeg} isSelected={isSelected} />
              ))}
            </div>

            {betSlip.length > 0 && (
              <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100 }}>
                <button onClick={() => setView("slip")} style={{ ...btnStyle(C.gold, C.bg), padding: "12px 28px", fontSize: 15, boxShadow: "0 4px 24px #F5B80060" }}>
                  View Bet Slip ({betSlip.length}) →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── BET SLIP ── */}
        {view === "slip" && (
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Bet Slip</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setParlayMode(false)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${!parlayMode ? C.gold : C.border}`, background: !parlayMode ? C.goldDim : "transparent", color: !parlayMode ? C.gold : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Straight</button>
                <button onClick={() => setParlayMode(true)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${parlayMode ? C.gold : C.border}`, background: parlayMode ? C.goldDim : "transparent", color: parlayMode ? C.gold : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Parlay</button>
                {betSlip.length > 0 && <button onClick={() => { setBetSlip([]); setStakes({}); }} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer" }}>Clear</button>}
              </div>
            </div>

            {betSlip.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎯</div>
                <div style={{ fontWeight: 700 }}>No picks yet</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Go to Games and tap odds to add picks</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {betSlip.map(bet => (
                  <SlipLeg key={bet.key} bet={bet} parlayMode={parlayMode} stake={stakes[bet.key] || ""} onStake={v => setStakes(p => ({ ...p, [bet.key]: v }))} onRemove={() => removeLeg(bet.key)} />
                ))}

                {parlayMode && betSlip.length >= 2 && (
                  <div style={{ background: C.card, border: `1px solid ${C.gold}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.gold, marginBottom: 10 }}>
                      {betSlip.length}-Leg Parlay · {parlayMult.toFixed(2)}x
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, flex: 1 }}>
                        <span style={{ padding: "0 8px", color: C.muted, fontSize: 13 }}>$</span>
                        <input type="number" min="0" placeholder="Stake" value={parlayStake} onChange={e => setParlayStake(e.target.value)} style={{ background: "none", border: "none", color: C.text, fontSize: 14, fontWeight: 700, width: "100%", padding: "9px 0", outline: "none" }} />
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}>
                        To win: <span style={{ color: C.gold, fontWeight: 800 }}>${parlayReturn > 0 ? (parlayReturn - parlayStakeNum).toFixed(2) : "0.00"}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Total return if all legs hit: <strong style={{ color: C.gold }}>${parlayReturn.toFixed(2)}</strong></div>
                  </div>
                )}

                {!parlayMode && betSlip.length > 0 && (
                  <div style={{ background: C.card, borderRadius: 10, padding: 12, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: C.muted }}>Total Stake</span>
                      <span style={{ fontWeight: 700 }}>${totalStraightStake.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: C.muted }}>Potential Return</span>
                      <span style={{ fontWeight: 800, color: C.gold }}>${totalStraightReturn.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <button onClick={placeBets} style={btnStyle(C.gold, C.bg, { fontSize: 15, padding: "13px 0", fontWeight: 900 })}>
                  {parlayMode ? `Place Parlay · $${parlayReturn.toFixed(2)} to return` : `Place ${betSlip.filter(b => stakes[b.key] > 0).length || betSlip.length} Bet${betSlip.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── LEADERBOARD ── */}
        {view === "leaderboard" && (
          <div>
            <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>🏆 Standings</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leaderboard.map((m, i) => (
                <div key={m.id} style={{ background: C.card, border: `1px solid ${i === 0 ? C.gold : C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: i === 0 ? C.gold : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : C.muted, minWidth: 28, textAlign: "center" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name} {m.id === currentUser.id && <span style={{ color: C.gold, fontSize: 11 }}>(you)</span>}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{m.role} · {m.status}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? C.gold : C.text, fontVariantNumeric: "tabular-nums" }}>
                    ${m.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MY BETS ── */}
        {view === "history" && (
          <div>
            <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>📋 My Wagers</h2>
            {myWagers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: C.muted }}>
                <div style={{ fontSize: 36 }}>📭</div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>No wagers yet</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {myWagers.map(w => <WagerCard key={w.id} wager={w} />)}
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN ── */}
        {view === "admin" && canAdmin && (
          <div>
            <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>⚙️ Admin Panel</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["members", "grade"].map(t => (
                <button key={t} onClick={() => setAdminTab(t)} style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${adminTab === t ? C.gold : C.border}`, background: adminTab === t ? C.goldDim : "transparent", color: adminTab === t ? C.gold : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>
                  {t === "grade" ? "Grade Wagers" : "Members"}
                </button>
              ))}
            </div>

            {adminTab === "members" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Add Member */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Add Member</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input placeholder="Name" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} style={inputStyle} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <input placeholder="Starting balance" type="number" value={newMemberBalance} onChange={e => setNewMemberBalance(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                      <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                        <option value="member">Member</option>
                        <option value="mod">Moderator</option>
                      </select>
                    </div>
                    <button onClick={addMember} style={btnStyle(C.gold, C.bg)}>Create & Get Invite Code</button>
                  </div>
                </div>

                {/* Member List */}
                {members.map(m => (
                  <div key={m.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{m.role} · {m.status} · Code: <span style={{ color: C.gold, fontWeight: 700 }}>{m.inviteCode || "—"}</span></div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: C.gold }}>${m.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => updateMemberBalance(m.id, 100)} style={smallBtn(C.green)}>+$100</button>
                      <button onClick={() => updateMemberBalance(m.id, -100)} style={smallBtn(C.red)}>-$100</button>
                      <button onClick={() => updateMemberBalance(m.id, 500)} style={smallBtn(C.green)}>+$500</button>
                      {m.role !== "owner" && currentUser.role === "owner" && (
                        <>
                          <button onClick={() => promoteRole(m.id, m.role === "mod" ? "member" : "mod")} style={smallBtn(C.blue)}>{m.role === "mod" ? "Demote" : "Make Mod"}</button>
                          <button onClick={() => toggleMemberStatus(m.id)} style={smallBtn(m.status === "active" ? C.red : C.green)}>{m.status === "active" ? "Suspend" : "Reinstate"}</button>
                          <button onClick={() => resetCode(m.id)} style={smallBtn(C.muted)}>New Code</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === "grade" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {wagers.filter(w => w.result === "pending").length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
                    <div style={{ fontSize: 32 }}>✅</div>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>All wagers graded</div>
                  </div>
                )}
                {wagers.filter(w => w.result === "pending").map(w => (
                  <div key={w.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{w.memberName} · {w.type === "parlay" ? `${w.legs.length}-Leg Parlay` : "Straight"} · ${w.stake} → ${w.potentialReturn}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{w.placedAt}</div>

                    {w.type === "straight" ? (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 13, marginBottom: 6 }}>{w.leg.label} · <span style={{ color: C.gold }}>{fmt(w.leg.odds)}</span></div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => gradeWager(w.id, "win")} style={smallBtn(C.green)}>✓ Win</button>
                          <button onClick={() => gradeWager(w.id, "loss")} style={smallBtn(C.red)}>✗ Loss</button>
                          <button onClick={() => gradeWager(w.id, "push")} style={smallBtn(C.muted)}>↔ Push</button>
                        </div>
                      </div>
                    ) : (
                      w.legs.map(leg => (
                        <div key={leg.key} style={{ marginBottom: 8, paddingLeft: 10, borderLeft: `2px solid ${leg.result === "win" ? C.green : leg.result === "loss" ? C.red : C.border}` }}>
                          <div style={{ fontSize: 13, marginBottom: 4 }}>{leg.label} · <span style={{ color: C.gold }}>{fmt(leg.odds)}</span> · <span style={{ color: leg.result === "pending" ? C.muted : leg.result === "win" ? C.green : C.red }}>{leg.result}</span></div>
                          {leg.result === "pending" && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => gradeWager(w.id, "win", leg.key)} style={smallBtn(C.green)}>✓ Win</button>
                              <button onClick={() => gradeWager(w.id, "loss", leg.key)} style={smallBtn(C.red)}>✗ Loss</button>
                              <button onClick={() => gradeWager(w.id, "push", leg.key)} style={smallBtn(C.muted)}>↔ Push</button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ loginName, setLoginName, loginCode, setLoginCode, loginErr, onLogin }) {
  return (
    <div style={{ background: "#0A0E1A", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>🏈</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-1px", color: "#F5B800" }}>DOUBLE B</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#E2E8F0", letterSpacing: 3 }}>SPORTS</div>
          <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>Private Members Only</div>
        </div>
        <div style={{ background: "#111827", border: "1px solid #1F2D45", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input placeholder="Your name" value={loginName} onChange={e => setLoginName(e.target.value)} style={inputStyle} onKeyDown={e => e.key === "Enter" && onLogin()} />
            <input placeholder="Invite code (members only)" value={loginCode} onChange={e => setLoginCode(e.target.value.toUpperCase())} style={{ ...inputStyle, letterSpacing: 4, fontWeight: 700 }} onKeyDown={e => e.key === "Enter" && onLogin()} />
            {loginErr && <div style={{ color: "#EF4444", fontSize: 13 }}>{loginErr}</div>}
            <button onClick={onLogin} style={{ background: "#F5B800", color: "#0A0E1A", border: "none", borderRadius: 8, padding: "13px 0", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>Enter</button>
          </div>
        </div>
        <div style={{ textAlign: "center", color: "#64748B", fontSize: 12, marginTop: 20 }}>By entering, you agree this is for entertainment only.</div>
      </div>
    </div>
  );
}

// ─── Game Row ─────────────────────────────────────────────────────────────────
function GameRow({ game, sport, toggleLeg, isSelected }) {
  const showSpread = !["MLB", "NHL", "MMA"].includes(sport) && game.spread !== null;
  return (
    <div style={{ background: "#1A2235", border: "1px solid #1F2D45", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
          {game.live ? <span style={{ color: "#EF4444", fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", display: "inline-block" }} />LIVE</span> : game.time}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, 90px)", gap: 8, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{game.away}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{game.home}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <OBtn label={fmt(game.awayOdds)} sel={isSelected(game.id, "ml-away")} onClick={() => toggleLeg(game, "ml-away", `${game.away} ML`, game.awayOdds)} />
          <OBtn label={fmt(game.homeOdds)} sel={isSelected(game.id, "ml-home")} onClick={() => toggleLeg(game, "ml-home", `${game.home} ML`, game.homeOdds)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {showSpread ? <>
            <OBtn label={`+${game.spread}`} sel={isSelected(game.id, "spd-away")} onClick={() => toggleLeg(game, "spd-away", `${game.away} +${game.spread}`, -110)} small />
            <OBtn label={`-${game.spread}`} sel={isSelected(game.id, "spd-home")} onClick={() => toggleLeg(game, "spd-home", `${game.home} -${game.spread}`, -110)} small />
          </> : <div style={{ textAlign: "center", color: "#1F2D45", fontSize: 20 }}>—</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {game.ou ? <>
            <OBtn label={`O ${game.ou}`} sel={isSelected(game.id, "over")} onClick={() => toggleLeg(game, "over", `Over ${game.ou}`, -110)} small />
            <OBtn label={`U ${game.ou}`} sel={isSelected(game.id, "under")} onClick={() => toggleLeg(game, "under", `Under ${game.ou}`, -110)} small />
          </> : <div style={{ textAlign: "center", color: "#1F2D45", fontSize: 20 }}>—</div>}
        </div>
      </div>
    </div>
  );
}

function OBtn({ label, sel, onClick, small }) {
  return (
    <button onClick={onClick} style={{ background: sel ? "#F5B80020" : "#0A0E1A", border: `1px solid ${sel ? "#F5B800" : "#1F2D45"}`, borderRadius: 6, padding: small ? "5px 4px" : "8px 4px", color: sel ? "#F5B800" : "#E2E8F0", fontWeight: 700, fontSize: small ? 11 : 13, cursor: "pointer", transition: "all 0.1s", width: "100%", height: 34, fontVariantNumeric: "tabular-nums" }}>
      {label}
    </button>
  );
}

// ─── Slip Leg ─────────────────────────────────────────────────────────────────
function SlipLeg({ bet, parlayMode, stake, onStake, onRemove }) {
  const s = parseFloat(stake) || 0;
  const win = calcWin(bet.odds, s);
  return (
    <div style={{ background: "#1A2235", border: "1px solid #1F2D45", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: 1, paddingRight: 8, lineHeight: 1.4 }}>{bet.label}</div>
        <button onClick={onRemove} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: parlayMode ? 0 : 8 }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: bet.odds > 0 ? "#22C55E" : "#E2E8F0" }}>{fmt(bet.odds)}</span>
        <span style={{ fontSize: 12, color: "#64748B" }}>{bet.sport}</span>
      </div>
      {!parlayMode && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", background: "#0A0E1A", border: "1px solid #1F2D45", borderRadius: 6, flex: 1 }}>
              <span style={{ padding: "0 8px", color: "#64748B", fontSize: 13 }}>$</span>
              <input type="number" min="0" placeholder="Stake" value={stake} onChange={e => onStake(e.target.value)} style={{ background: "none", border: "none", color: "#E2E8F0", fontSize: 14, fontWeight: 700, width: "100%", padding: "8px 0", outline: "none" }} />
            </div>
            <span style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>Win: <strong style={{ color: "#F5B800" }}>${win.toFixed(2)}</strong></span>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
            {[10, 25, 50, 100].map(v => (
              <button key={v} onClick={() => onStake(v)} style={{ flex: 1, padding: "5px 0", background: "#0A0E1A", border: "1px solid #1F2D45", borderRadius: 5, color: "#64748B", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>${v}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Wager Card ───────────────────────────────────────────────────────────────
function WagerCard({ wager }) {
  const color = wager.result === "win" ? "#22C55E" : wager.result === "loss" ? "#EF4444" : wager.result === "push" ? "#64748B" : "#F5B800";
  return (
    <div style={{ background: "#1A2235", border: `1px solid ${wager.result === "pending" ? "#1F2D45" : color + "50"}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{wager.type === "parlay" ? `${wager.legs.length}-Leg Parlay` : "Straight Bet"}</span>
          <span style={{ fontSize: 11, color: "#64748B", marginLeft: 8 }}>{wager.placedAt}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 900, color, textTransform: "uppercase" }}>{wager.result}</span>
      </div>

      {wager.type === "straight" ? (
        <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 6 }}>{wager.leg.label} · <span style={{ color: "#F5B800", fontWeight: 700 }}>{fmt(wager.leg.odds)}</span></div>
      ) : (
        wager.legs.map((l, i) => (
          <div key={i} style={{ fontSize: 13, color: "#94A3B8", marginBottom: 3 }}>
            {l.label} · <span style={{ color: "#F5B800", fontWeight: 700 }}>{fmt(l.odds)}</span>
            {l.result !== "pending" && <span style={{ marginLeft: 6, color: l.result === "win" ? "#22C55E" : l.result === "loss" ? "#EF4444" : "#64748B", fontWeight: 700 }}>({l.result})</span>}
          </div>
        ))
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13 }}>
        <span style={{ color: "#64748B" }}>Stake: <strong style={{ color: "#E2E8F0" }}>${wager.stake}</strong></span>
        <span style={{ color: "#64748B" }}>To return: <strong style={{ color: "#F5B800" }}>${wager.potentialReturn.toFixed(2)}</strong></span>
      </div>
    </div>
  );
}

// ─── Style Helpers ────────────────────────────────────────────────────────────
const inputStyle = { background: "#0A0E1A", border: "1px solid #1F2D45", borderRadius: 8, padding: "10px 12px", color: "#E2E8F0", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const btnStyle = (bg, color, extra = {}) => ({ background: bg, color, border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 800, fontSize: 14, cursor: "pointer", width: "100%", transition: "opacity 0.1s", ...extra });
const smallBtn = (color) => ({ background: color + "20", border: `1px solid ${color}40`, color, padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" });
