import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const fmt = (o) => (o > 0 ? `+${o}` : `${o}`);
const calcWin = (odds, stake) => odds > 0 ? +(stake * odds / 100).toFixed(2) : +(stake * 100 / Math.abs(odds)).toFixed(2);
const parlayMultiplier = (legs) => legs.reduce((acc, odds) => {
  const dec = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
  return acc * dec;
}, 1);
const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const sportIcon = {
  americanfootball_nfl: "🏈", americanfootball_ncaaf: "🏈", americanfootball_nfl_preseason: "🏈", americanfootball_cfl: "🏈",
  basketball_nba_summer_league: "🏀", basketball_wnba: "🏀",
  baseball_mlb: "⚾",
  icehockey_nhl: "🏒",
  mma_mixed_martial_arts: "🥊", boxing_boxing: "🥊",
  golf_masters_tournament_winner: "⛳", golf_the_open_championship_winner: "⛳",
  aussierules_afl: "🏉",
};
const sportLabel = {
  americanfootball_nfl: "NFL", americanfootball_ncaaf: "NCAAF", americanfootball_nfl_preseason: "NFL Pre", americanfootball_cfl: "CFL",
  basketball_nba_summer_league: "NBA SL", basketball_wnba: "WNBA",
  baseball_mlb: "MLB",
  icehockey_nhl: "NHL",
  mma_mixed_martial_arts: "MMA", boxing_boxing: "Boxing",
  golf_masters_tournament_winner: "Masters", golf_the_open_championship_winner: "The Open",
  aussierules_afl: "AFL",
};
const SPORT_KEYS = [
  "americanfootball_nfl", "americanfootball_ncaaf", "americanfootball_nfl_preseason", "americanfootball_cfl",
  "basketball_nba_summer_league", "basketball_wnba",
  "baseball_mlb",
  "icehockey_nhl",
  "mma_mixed_martial_arts", "boxing_boxing",
  "golf_masters_tournament_winner", "golf_the_open_championship_winner",
  "aussierules_afl",
];

const C = {
  bg: "#0A0E1A", surface: "#111827", card: "#1A2235", border: "#1F2D45",
  gold: "#F5B800", goldDim: "#F5B80025", blue: "#3B82F6",
  red: "#EF4444", green: "#22C55E",
  text: "#E2E8F0", muted: "#64748B",
};

function toAmerican(decimal) {
  if (!decimal) return null;
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

export default function DoubleBSports() {
  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState([]);
  const [wagers, setWagers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginName, setLoginName] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [view, setView] = useState("games");
  const [sport, setSport] = useState("americanfootball_nfl")
  const [betSlip, setBetSlip] = useState([]);
  const [stakes, setStakes] = useState({});
  const [parlayMode, setParlayMode] = useState(false);
  const [parlayStake, setParlayStake] = useState("");
  const [toast, setToast] = useState(null);
  const [games, setGames] = useState({});
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState(null);
  const [adminTab, setAdminTab] = useState("members");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberBalance, setNewMemberBalance] = useState("1000");
  const [newMemberRole, setNewMemberRole] = useState("member");
  const [showInvite, setShowInvite] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const API_KEY = import.meta.env.VITE_ODDS_API_KEY || "21f52815b23642d0ce9694b77e44b516";

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from("members").select("*");
      const { data: w } = await supabase.from("wagers").select("*");
      if (m && m.length) setMembers(m.map(r => ({ id: r.id, name: r.name, role: r.role, balance: r.balance, inviteCode: r.invite_code, status: r.status, joinedAt: r.joined_at })));
      if (w) setWagers(w.map(r => ({ id: r.id, memberId: r.member_id, memberName: r.member_name, type: r.type, stake: r.stake, potentialReturn: r.potential_return, result: r.result, placedAt: r.placed_at, leg: r.leg, legs: r.legs })));
      setLoaded(true);
    })();
  }, []);



  const fetchOdds = useCallback(async (sportKey) => {
    if (!API_KEY) { setGamesError("No API key found. Check your .env file."); return; }
    setGamesLoading(true);
    setGamesError(null);
    try {
      const res = await axios.get(
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`,
        { params: { apiKey: API_KEY, regions: "us", markets: "h2h,spreads,totals", oddsFormat: "decimal", dateFormat: "iso" } }
      );
      const parsed = res.data.map((game) => {
        const bookmaker = game.bookmakers?.[0];
        const h2h = bookmaker?.markets?.find((m) => m.key === "h2h");
        const spread = bookmaker?.markets?.find((m) => m.key === "spreads");
        const totals = bookmaker?.markets?.find((m) => m.key === "totals");
        const homeH2H = h2h?.outcomes?.find((o) => o.name === game.home_team);
        const awayH2H = h2h?.outcomes?.find((o) => o.name === game.away_team);
        const homeSpread = spread?.outcomes?.find((o) => o.name === game.home_team);
        const awaySpread = spread?.outcomes?.find((o) => o.name === game.away_team);
        const over = totals?.outcomes?.find((o) => o.name === "Over");
        const under = totals?.outcomes?.find((o) => o.name === "Under");
        const gameTime = new Date(game.commence_time);
        const isLive = gameTime <= new Date();
        return {
          id: game.id, sport: sportKey,
          home: game.home_team, away: game.away_team,
          time: isLive ? "LIVE" : gameTime.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
          live: isLive,
          homeOdds: homeH2H ? toAmerican(homeH2H.price) : null,
          awayOdds: awayH2H ? toAmerican(awayH2H.price) : null,
          homeSpread: homeSpread ? homeSpread.point : null,
          awaySpread: awaySpread ? awaySpread.point : null,
          spreadOdds: homeSpread ? toAmerican(homeSpread.price) : -110,
          ou: over ? over.point : null,
          overOdds: over ? toAmerican(over.price) : -110,
          underOdds: under ? toAmerican(under.price) : -110,
          status: "open",
        };
      });
      // Filter out games that started more than 5 hours ago
      const now = new Date();
      const cutoff = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      const filtered = parsed.filter(g => new Date(res.data.find(x => x.id === g.id)?.commence_time) > new Date());
      setGames((prev) => ({ ...prev, [sportKey]: filtered }));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      if (err.response?.status === 401) setGamesError("Invalid API key.");
      else if (err.response?.status === 429) setGamesError("API limit reached. Try again later.");
      else setGamesError("Could not load odds. Check your connection.");
    } finally {
      setGamesLoading(false);
    }
  }, [API_KEY]);

  useEffect(() => { if (currentUser) fetchOdds(sport); }, [sport, currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    const t = setInterval(() => fetchOdds(sport), 120000);
    return () => clearInterval(t);
  }, [sport, currentUser, fetchOdds]);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

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
  const refreshUser = (updated) => { setCurrentUser(updated); setMembers(prev => prev.map(m => m.id === updated.id ? updated : m)); };

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

  const placeBets = async () => {
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
      await supabase.from("wagers").insert({ id: wager.id, member_id: wager.memberId, member_name: wager.memberName, type: wager.type, legs: wager.legs, stake: wager.stake, potential_return: wager.potentialReturn, result: wager.result, placed_at: wager.placedAt });
      await supabase.from("members").update({ balance: updated.balance }).eq("id", currentUser.id);
      setWagers(p => [wager, ...p]);
      refreshUser(updated);
      setBetSlip([]); setStakes({}); setParlayStake(""); setParlayMode(false);
      showToast(`Parlay placed! ${betSlip.length} legs`);
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
      for (const w of newWagers) {
        await supabase.from("wagers").insert({ id: w.id, member_id: w.memberId, member_name: w.memberName, type: w.type, leg: w.leg, stake: w.stake, potential_return: w.potentialReturn, result: w.result, placed_at: w.placedAt });
      }
      await supabase.from("members").update({ balance: updated.balance }).eq("id", currentUser.id);
      setWagers(p => [...newWagers, ...p]);
      refreshUser(updated);
      setBetSlip([]); setStakes({});
      showToast(`${valid.length} bet${valid.length > 1 ? "s" : ""} placed!`);
    }
    setView("history");
  };

  const gradeWager = async (wagerId, result, legKey = null) => {
    const w = wagers.find(x => x.id === wagerId);
    if (!w) return;
    if (w.type === "straight") {
      const member = members.find(m => m.id === w.memberId);
      if (!member) return;
      const payout = result === "win" ? w.potentialReturn : result === "push" ? w.stake : 0;
      const newBalance = +(member.balance + payout).toFixed(2);
      await supabase.from("wagers").update({ result, leg: { ...w.leg, result } }).eq("id", wagerId);
      await supabase.from("members").update({ balance: newBalance }).eq("id", member.id);
      setWagers(prev => prev.map(x => x.id === wagerId ? { ...x, result, leg: { ...x.leg, result } } : x));
      setMembers(pm => pm.map(m => m.id === member.id ? { ...m, balance: newBalance } : m));
      if (currentUser?.id === member.id) setCurrentUser({ ...currentUser, balance: newBalance });
    } else {
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
          const newBalance = +(member.balance + payout).toFixed(2);
          await supabase.from("members").update({ balance: newBalance }).eq("id", member.id);
          setMembers(pm => pm.map(m => m.id === member.id ? { ...m, balance: newBalance } : m));
          if (currentUser?.id === member.id) setCurrentUser({ ...currentUser, balance: newBalance });
        }
      }
      await supabase.from("wagers").update({ result: parlayResult, legs }).eq("id", wagerId);
      setWagers(prev => prev.map(x => x.id === wagerId ? { ...x, legs, result: parlayResult } : x));
    }
    showToast("Wager graded");
  };

  const addMember = async () => {
    if (!newMemberName.trim()) return;
    const code = genCode();
    const m = { id: `m-${Date.now()}`, name: newMemberName.trim(), role: newMemberRole, balance: parseFloat(newMemberBalance) || 1000, inviteCode: code, status: "active", joinedAt: Date.now() };
    await supabase.from("members").insert({ id: m.id, name: m.name, role: m.role, balance: m.balance, invite_code: m.inviteCode, status: m.status, joined_at: m.joinedAt });
    setMembers(p => [...p, m]);
    setShowInvite({ name: m.name, code });
    setNewMemberName(""); setNewMemberBalance("1000"); setNewMemberRole("member");
  };
  const updateMemberBalance = async (id, delta) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    const newBalance = +(member.balance + delta).toFixed(2);
    await supabase.from("members").update({ balance: newBalance }).eq("id", id);
    setMembers(p => p.map(m => m.id === id ? { ...m, balance: newBalance } : m));
  };
  const setMemberBalance = async (id, amount) => {
    if (!amount) return;
    const newBalance = +parseFloat(amount).toFixed(2);
    await supabase.from("members").update({ balance: newBalance }).eq("id", id);
    setMembers(p => p.map(m => m.id === id ? { ...m, balance: newBalance } : m));
    showToast("Balance updated!");
  };
  const [customAmounts, setCustomAmounts] = useState({});
  const toggleMemberStatus = async (id) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    const newStatus = member.status === "active" ? "suspended" : "active";
    await supabase.from("members").update({ status: newStatus }).eq("id", id);
    setMembers(p => p.map(m => m.id === id ? { ...m, status: newStatus } : m));
  };
  const promoteRole = async (id, role) => {
    await supabase.from("members").update({ role }).eq("id", id);
    setMembers(p => p.map(m => m.id === id ? { ...m, role } : m));
  };
  const resetCode = async (id) => {
    const code = genCode();
    await supabase.from("members").update({ invite_code: code }).eq("id", id);
    setMembers(p => p.map(m => m.id === id ? { ...m, inviteCode: code } : m));
    setShowInvite({ name: members.find(m => m.id === id)?.name, code });
  };

  const canAdmin = currentUser?.role === "owner" || currentUser?.role === "mod";
  const myWagers = wagers.filter(w => w.memberId === currentUser?.id);
  const leaderboard = [...members].sort((a, b) => b.balance - a.balance);
  const currentGames = games[sport] || [];

  if (!loaded) return <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, fontSize: 18, fontWeight: 700 }}>Loading Double B Sports…</div>;
  if (!currentUser) return <LoginScreen loginName={loginName} setLoginName={setLoginName} loginCode={loginCode} setLoginCode={setLoginCode} loginErr={loginErr} onLogin={handleLogin} />;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Inter','Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
      {toast && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? C.red : C.green, color: "#fff", padding: "10px 20px", borderRadius: 8, fontWeight: 700, fontSize: 14, zIndex: 9999, whiteSpace: "nowrap" }}>{toast.msg}</div>}

      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, maxWidth: 340, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🎟️</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Invite Code for {showInvite.name}</div>
            <div style={{ background: C.bg, border: `2px dashed ${C.gold}`, borderRadius: 8, padding: "14px 0", fontSize: 28, fontWeight: 900, letterSpacing: 6, color: C.gold, margin: "16px 0" }}>{showInvite.code}</div>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Share this code with the member. They use their name + this code to log in.</div>
            <button onClick={() => setShowInvite(null)} style={btnStyle(C.gold, C.bg)}>Done</button>
          </div>
        </div>
      )}

      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54, position: "sticky", top: 0, zIndex: 50 }}>
        <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-1px" }}>
          <span style={{ color: C.gold }}>DOUBLE B</span><span style={{ color: C.text }}> SPORTS</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.muted }}>{currentUser.name} · {currentUser.role}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>${currentUser.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
          <button onClick={logout} style={{ background: C.border, border: "none", color: C.muted, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Out</button>
        </div>
      </header>

      <nav style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", overflowX: "auto" }}>
        {[
          { id: "games", label: "🏟 Games" },
          { id: "slip", label: `🎯 Slip${betSlip.length ? ` (${betSlip.length})` : ""}` },
          ...(canAdmin ? [{ id: "leaderboard", label: "🏆 Board" }] : []),
          { id: "history", label: "📋 My Bets" },
          ...(canAdmin ? [{ id: "admin", label: "⚙️ Admin" }] : []),
        ].map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{ background: "none", border: "none", padding: "11px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700, color: view === n.id ? C.gold : C.muted, borderBottom: `2px solid ${view === n.id ? C.gold : "transparent"}`, whiteSpace: "nowrap" }}>
            {n.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "16px 12px" }}>

        {view === "games" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
              {SPORT_KEYS.map(s => (
                <button key={s} onClick={() => setSport(s)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${sport === s ? C.gold : C.border}`, background: sport === s ? C.goldDim : "transparent", color: sport === s ? C.gold : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {sportIcon[s]} {sportLabel[s]}
                </button>
              ))}
              <button onClick={() => fetchOdds(sport)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🔄 Refresh</button>
            </div>

            {gamesLoading && <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>Loading live odds…</div>}
            {gamesError && <div style={{ textAlign: "center", padding: "40px 0", color: C.red }}>{gamesError}</div>}
            {!gamesLoading && !gamesError && currentGames.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
                <div style={{ fontSize: 36 }}>📭</div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>No games available right now</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Check back later or try another sport</div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {currentGames.map(game => <GameRow key={game.id} game={game} toggleLeg={toggleLeg} isSelected={isSelected} />)}
            </div>

            {betSlip.length > 0 && (
              <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100 }}>
                <button onClick={() => setView("slip")} style={{ ...btnStyle(C.gold, C.bg), padding: "12px 28px", fontSize: 15, boxShadow: "0 4px 24px #F5B80060", width: "auto" }}>
                  View Bet Slip ({betSlip.length}) →
                </button>
              </div>
            )}
          </div>
        )}

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
                {betSlip.map(bet => <SlipLeg key={bet.key} bet={bet} parlayMode={parlayMode} stake={stakes[bet.key] || ""} onStake={v => setStakes(p => ({ ...p, [bet.key]: v }))} onRemove={() => removeLeg(bet.key)} />)}

                {parlayMode && betSlip.length >= 2 && (
                  <div style={{ background: C.card, border: `1px solid ${C.gold}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.gold, marginBottom: 10 }}>{betSlip.length}-Leg Parlay · {parlayMult.toFixed(2)}x</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, flex: 1 }}>
                        <span style={{ padding: "0 8px", color: C.muted, fontSize: 13 }}>$</span>
                        <input type="number" min="0" placeholder="Stake" value={parlayStake} onChange={e => setParlayStake(e.target.value)} style={{ background: "none", border: "none", color: C.text, fontSize: 14, fontWeight: 700, width: "100%", padding: "9px 0", outline: "none" }} />
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}>To win: <span style={{ color: C.gold, fontWeight: 800 }}>${parlayReturn > 0 ? (parlayReturn - parlayStakeNum).toFixed(2) : "0.00"}</span></div>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Total return: <strong style={{ color: C.gold }}>${parlayReturn.toFixed(2)}</strong></div>
                  </div>
                )}

                {!parlayMode && (
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
                  {parlayMode ? `Place Parlay · $${parlayReturn.toFixed(2)} to return` : `Place ${betSlip.length} Bet${betSlip.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}
          </div>
        )}

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
                  <div style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? C.gold : C.text }}>${m.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {view === "admin" && canAdmin && (
          <div>
            <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>⚙️ Admin Panel</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["members", "grade"].map(t => (
                <button key={t} onClick={() => setAdminTab(t)} style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${adminTab === t ? C.gold : C.border}`, background: adminTab === t ? C.goldDim : "transparent", color: adminTab === t ? C.gold : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {t === "grade" ? "Grade Wagers" : "Members"}
                </button>
              ))}
            </div>

            {adminTab === "members" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                      <div style={{ display: "flex", gap: 4, width: "100%", marginTop: 6 }}>
                        <input type="number" placeholder="Set exact balance" value={customAmounts[m.id] || ""} onChange={e => setCustomAmounts(p => ({ ...p, [m.id]: e.target.value }))} style={{ ...inputStyle, flex: 1, padding: "6px 10px", fontSize: 12 }} />
                        <button onClick={() => { setMemberBalance(m.id, customAmounts[m.id]); setCustomAmounts(p => ({ ...p, [m.id]: "" })); }} style={{ ...smallBtn(C.gold), whiteSpace: "nowrap" }}>Set</button>
                      </div>
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
                          <div style={{ fontSize: 13, marginBottom: 4 }}>{leg.label} · <span style={{ color: C.gold }}>{fmt(leg.odds)}</span> · <span style={{ color: leg.result === "pending" ? C.muted : leg.result === "win" ? C.green : C.red, fontWeight: 700 }}>{leg.result}</span></div>
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
        <div style={{ textAlign: "center", color: "#64748B", fontSize: 12, marginTop: 20 }}>For entertainment purposes only.</div>
      </div>
    </div>
  );
}

function GameRow({ game, toggleLeg, isSelected }) {
  return (
    <div style={{ background: "#1A2235", border: "1px solid #1F2D45", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
          {game.live ? <span style={{ color: "#EF4444", fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", display: "inline-block" }} />LIVE</span> : game.time}
        </div>
      </div>
<div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, 75px)", gap: 4, alignItems: "center" }}>        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{game.away}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{game.home}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <OBtn label={game.awayOdds !== null ? (game.awayOdds > 0 ? `+${game.awayOdds}` : `${game.awayOdds}`) : "N/A"} sel={isSelected(game.id, "ml-away")} onClick={() => game.awayOdds && toggleLeg(game, "ml-away", `${game.away} ML`, game.awayOdds)} />
          <OBtn label={game.homeOdds !== null ? (game.homeOdds > 0 ? `+${game.homeOdds}` : `${game.homeOdds}`) : "N/A"} sel={isSelected(game.id, "ml-home")} onClick={() => game.homeOdds && toggleLeg(game, "ml-home", `${game.home} ML`, game.homeOdds)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {game.awaySpread !== null ? <>
            <OBtn label={`${game.awaySpread > 0 ? "+" : ""}${game.awaySpread}`} sel={isSelected(game.id, "spd-away")} onClick={() => toggleLeg(game, "spd-away", `${game.away} ${game.awaySpread > 0 ? "+" : ""}${game.awaySpread}`, game.spreadOdds)} small />
            <OBtn label={`${game.homeSpread > 0 ? "+" : ""}${game.homeSpread}`} sel={isSelected(game.id, "spd-home")} onClick={() => toggleLeg(game, "spd-home", `${game.home} ${game.homeSpread > 0 ? "+" : ""}${game.homeSpread}`, game.spreadOdds)} small />
          </> : <div style={{ textAlign: "center", color: "#1F2D45", fontSize: 20 }}>—</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {game.ou ? <>
            <OBtn label={`O ${game.ou}`} sel={isSelected(game.id, "over")} onClick={() => toggleLeg(game, "over", `Over ${game.ou}`, game.overOdds)} small />
            <OBtn label={`U ${game.ou}`} sel={isSelected(game.id, "under")} onClick={() => toggleLeg(game, "under", `Under ${game.ou}`, game.underOdds)} small />
          </> : <div style={{ textAlign: "center", color: "#1F2D45", fontSize: 20 }}>—</div>}
        </div>
      </div>
    </div>
  );
}

function OBtn({ label, sel, onClick, small }) {
  return (
    <button onClick={onClick} style={{ background: sel ? "#F5B80020" : "#0A0E1A", border: `1px solid ${sel ? "#F5B800" : "#1F2D45"}`, borderRadius: 6, padding: small ? "5px 4px" : "8px 4px", color: sel ? "#F5B800" : "#E2E8F0", fontWeight: 700, fontSize: small ? 11 : 13, cursor: "pointer", width: "100%", height: 34, fontVariantNumeric: "tabular-nums" }}>
      {label}
    </button>
  );
}

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
        <span style={{ fontSize: 15, fontWeight: 900, color: bet.odds > 0 ? "#22C55E" : "#E2E8F0" }}>{bet.odds > 0 ? `+${bet.odds}` : bet.odds}</span>
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
        <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 6 }}>{wager.leg.label} · <span style={{ color: "#F5B800", fontWeight: 700 }}>{wager.leg.odds > 0 ? `+${wager.leg.odds}` : wager.leg.odds}</span></div>
      ) : (
        wager.legs.map((l, i) => (
          <div key={i} style={{ fontSize: 13, color: "#94A3B8", marginBottom: 3 }}>
            {l.label} · <span style={{ color: "#F5B800", fontWeight: 700 }}>{l.odds > 0 ? `+${l.odds}` : l.odds}</span>
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

const inputStyle = { background: "#0A0E1A", border: "1px solid #1F2D45", borderRadius: 8, padding: "10px 12px", color: "#E2E8F0", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const btnStyle = (bg, color, extra = {}) => ({ background: bg, color, border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 800, fontSize: 14, cursor: "pointer", width: "100%", transition: "opacity 0.1s", ...extra });
const smallBtn = (color) => ({ background: color + "20", border: `1px solid ${color}40`, color, padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" });
