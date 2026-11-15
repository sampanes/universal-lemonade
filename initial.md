

## 1. Cohesive Mathematical Spine (How the Phases Connect)

To prevent the game from feeling like two separate games glued together, the state variables from Phase 1 carry forward mathematically into Phases 2 and 3:

1. **The Recipe-to-Brand Carryover (Phase 1 $\rightarrow$ Phase 2):**
   In Phase 1, the player tunes their recipe vector $\vec{r} = (L, S, I)$ against daily temperature $T_d$. When they trigger the **Squeeze-Bot 9000** transition, their peak recipe quality $Q_{\text{peak}} \in (0, 1]$ and neighborhood reputation $R_{\text{rep}} \in [0, 1]$ permanently lock in as the **Foundational Brand Multiplier** ($B_0 = 1 + 2 Q_{\text{peak}} R_{\text{rep}}$) for Phase 2's continuous demand curve.
2. **Continuous Inventory & Price-Velocity Coupling (Phase 2):**
   Instead of Phase 1's discrete daily customers, Phase 2 treats unsold cups as a continuous buffer $U(t)$. Production fills the buffer ($\frac{dU}{dt} = V_{\text{prod}} - V_{\text{sales}}$), while public demand drains it at a rate governed by hyperbolic price elasticity:

$$V_{\text{demand}}(p) = D_{\text{base}} \cdot B_0 \cdot (1.15)^{M_{\text{mkt}}} \cdot \left(\frac{p_{\text{fair}}}{p}\right)^{1.8}$$

$$V_{\text{sales}} = \min\left(U(t), \, V_{\text{demand}}(p)\right)$$

If the player prices too high, $U(t)$ piles up; if they price too low, $U(t)$ hits zero and revenue is bottlenecked by $V_{\text{prod}}$.
3. **Trust, Processors & Creativity (Phase 2 $\rightarrow$ Phase 3):**
Revenue buys physical generators (which scale geometrically at $r = 1.15$), while total cups produced hits Fibonacci-spaced **Trust milestones** ($10^3, 3\times 10^3, 10^4, 3\times 10^4 \dots$). Each Trust point is allocated between **Processors** (generating *Sugar Rush / Ops* capped by Memory) and **Memory** (expanding the Ops cap and generating *Zest / Creativity* when Processors are full).
4. **Von Neumann Probe ODEs & Lanchester Combat (Phase 3):**
At $10^{12}$ cups, Earth's supply chain saturates. Launching the **Orbital Citrus Probe** converts the loop into coupled differential equations across 6 allocation weights ($w_{\text{rep}}, w_{\text{haz}}, w_{\text{harv}}, w_{\text{fact}}, w_{\text{drift}}, w_{\text{combat}}$):

* **Net Probe Growth:** $\frac{dP}{dt} = P \cdot \left(\alpha_{\text{rep}} w_{\text{rep}} - \beta_{\text{haz}} \max(0, \, 0.25 - w_{\text{haz}}) - \delta_{\text{drift}} w_{\text{rep}}^2\right)$
* **Lime Bandit (Drifter) Accumulation:** $\frac{dD}{dt} = \delta_{\text{drift}} w_{\text{rep}}^2 P - \gamma_{\text{combat}} w_{\text{combat}} P$
* **Matter Depletion:** Probes harvest cosmic matter $M_{\text{cosmos}}$ (initialized at $3 \times 10^{55}\text{ g}$) into wire/lemons, which factories convert into cups at exponential scale.

---

## 2. Pacing Targets & Bottleneck Schedule

| Phase                     | Target Real-Time Window | Primary Bottleneck                                        | Escape Valve / Unlock                                                                                            |
| ------------------------- | ----------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Phase 1A (Days 1–5)**   | `0:00 – 3:00`           | Working capital & overnight ice melt ($100\%$ loss/night) | **Insulated Cooler** ($\$45$) stops ice spoilage.                                                                |
| **Phase 1B (Days 6–14)**  | `3:00 – 7:00`           | Weather variance & manual recipe matching                 | Hitting $\$500$ & $Q \ge 0.85$ unlocks **Squeeze-Bot 9000** ($\$500$).                                          |
| **Phase 2A (Early Idle)** | `7:00 – 15:00`          | Raw lemon/ice supply vs. Auto-Squeezer speed              | **Auto-Restock Contract** (500 Ops) automates raw material buying.                                               |
| **Phase 2B (Megacorp)**   | `15:00 – 28:00`         | Geometric generator wall ($1.15^n$) & Ops cap             | **Trust / Memory upgrades** unlock **Weather Control Satellite** (locks $T = 95^\circ\text{F}$).                 |
| **Phase 3 (Cosmic)**      | `28:00 – 45:00`         | Value Drift (*Lime Bandits*) & Matter depletion           | Balancing $w_{\text{haz}}$ and $w_{\text{combat}}$ until $M_{\text{cosmos}} \rightarrow 0$, triggering Prestige. |

---

## 3. Core Backend Engine (`engine.ts`)

This file has zero DOM or rendering dependencies. It contains the self-contained `BigNum` math struct, the state machine, the $O(1)$ geometric bulk-buy solver, the Phase 1–3 simulation loops, and an automated headless pacing simulator (`runHeadlessPacingTest`).

---

## 4. Barebones "Adult Click Test" & Telemetry Harness (`index.html`)

Drop this single file into a browser (or serve via Vite) alongside `engine.ts` to test playability, click pacing, and bottleneck transitions without any extra GUI distractions. It includes **Time Warp ($1\times, 10\times, 50\times$)** and an **Auto-Play Bot** button to verify scaling curves up to $10^{55}$.

```html

```


