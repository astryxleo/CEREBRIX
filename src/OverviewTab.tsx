import { motion } from "framer-motion";
import { Activity, ArrowUpRight, FileCode2, Users } from "lucide-react";

export type OverviewTabProps = {
  logoUrl?: string;
  totalStudents: number;
  activeTests: number;
  systemStatus?: "Operational" | "Degraded" | "Offline";
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: 1.25 + index * 0.14, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const statusColor: Record<NonNullable<OverviewTabProps["systemStatus"]>, string> = {
  Operational: "#34D399",
  Degraded: "#FBBF24",
  Offline: "#FB7185",
};

export default function OverviewTab({
  logoUrl = "/cerebrix.png",
  totalStudents,
  activeTests,
  systemStatus = "Operational",
}: OverviewTabProps) {
  const metrics = [
    { label: "Total Students", value: totalStudents.toLocaleString(), detail: "Students assigned to your class roster", icon: Users, accent: "#0066FF" },
    { label: "Active Tests", value: activeTests.toLocaleString(), detail: "Scheduled or published assessments", icon: FileCode2, accent: "#00CFFF" },
    { label: "System Status", value: systemStatus, detail: "Workspace service health", icon: Activity, accent: statusColor[systemStatus] },
  ];

  return (
    <section className="cbx-overview" aria-labelledby="cbx-overview-title">
      <div className="cbx-overview-atmosphere" aria-hidden="true" />
      <div className="cbx-overview-hero">
        <motion.div
          className="cbx-logo-stage"
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: [0, -9, 0, 8, 0] }}
          transition={{
            opacity: { duration: 1.5, ease: "easeOut" },
            scale: { duration: 1.5, ease: [0.16, 1, 0.3, 1] },
            y: { duration: 6.5, ease: "easeInOut", repeat: Infinity, repeatType: "loop", delay: 1.5 },
          }}
        >
          <motion.img
            className="cbx-overview-logo"
            src={logoUrl}
            alt="Cerebrix logo"
            draggable={false}
            onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
            animate={{
              filter: [
                "drop-shadow(0 0 14px rgba(0,102,255,.72)) drop-shadow(0 0 32px rgba(0,102,255,.25))",
                "drop-shadow(0 0 19px rgba(0,207,255,.88)) drop-shadow(0 0 48px rgba(0,207,255,.32))",
                "drop-shadow(0 0 14px rgba(0,102,255,.72)) drop-shadow(0 0 32px rgba(0,102,255,.25))",
              ],
            }}
            transition={{ filter: { duration: 4.2, ease: "easeInOut", repeat: Infinity, repeatType: "loop" } }}
          />
        </motion.div>

        <motion.div
          className="cbx-overview-copy"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.85, ease: "easeOut" }}
        >
          <div className="cbx-overview-kicker"><span /> CEREBRIX / COMMAND CENTER <span /></div>
          <h2 id="cbx-overview-title">Welcome to <span>Cerebrix</span><br className="cbx-title-break" /> Command Center<span className="cbx-title-period">.</span></h2>
          <p>Every assessment. Every insight. One intelligent workspace.</p>
        </motion.div>
      </div>

      <div className="cbx-overview-metrics">
        {metrics.map(({ label, value, detail, icon: Icon, accent }, index) => (
          <motion.article
            className="cbx-metric-card"
            key={label}
            custom={index}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -5, borderColor: "rgba(0,207,255,.42)", transition: { duration: 0.2 } }}
          >
            <div className="cbx-metric-card-top">
              <span>{label}</span>
              <span className="cbx-metric-icon" style={{ color: accent, background: `${accent}14`, borderColor: `${accent}45` }}><Icon size={17} /></span>
            </div>
            <strong className={label === "System Status" ? "cbx-metric-status" : ""} style={label === "System Status" ? { color: accent } : undefined}>{value}</strong>
            <p>{detail}</p>
            <div className="cbx-metric-card-bottom"><span style={{ background: accent, boxShadow: `0 0 12px ${accent}88` }} /><span>LIVE METRIC</span><ArrowUpRight size={13} /></div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
