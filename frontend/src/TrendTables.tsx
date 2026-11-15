import type { Forecast, Trend } from './api'
import { DataTable, SectionHead, type Column } from './DataTable'
import { fmtNum, fmtProb, TBL, tUnit, type Lang } from './i18n'
import { mean, sd } from './stats'

const signed = (x: number, lang: Lang, digits = 3) => `${x > 0 ? '+' : ''}${fmtNum(x, lang, digits)}`

type DescRow = { id: string; label: string; value: string; raw: string | number; read: string }
type MethodRow = {
  id: string; name: string; slope: string; slopeRaw: number; ci: string; p: string; pRaw: number | null; read: string; agree?: boolean
}
type YearRow = { id: string; kind: 'year' | 'decade'; label: string; mean: number; fitted: number | null; resid: number | null }

/** "Tabla estadística": descriptivos, método comparativo y datos por año de la serie. */
export function TrendTables({ trend: t, lang }: { trend: Trend; lang: Lang }) {
  const c = TBL[lang]
  const tt = c.trend
  const unit = tUnit(t.unit, lang)
  const annual = t.series?.annual ?? []

  // --- (a) estadísticos descriptivos
  const vals = annual.map((p) => p.mean)
  const m = mean(vals)
  const s = sd(vals)
  const lo = annual.reduce((a, p) => (p.mean < a.mean ? p : a), annual[0])
  const hi = annual.reduce((a, p) => (p.mean > a.mean ? p : a), annual[0])
  const cvOk = annual.length > 1 && Math.abs(m) > 1e-9
  const desc: DescRow[] = annual.length === 0 ? [] : [
    { id: 'n', label: tt.nYears, value: String(annual.length), raw: annual.length, read: tt.rNYears },
    { id: 'mean', label: tt.mean, value: `${fmtNum(m, lang, 4)} ${unit}`, raw: m, read: tt.rMean },
    { id: 'sd', label: tt.sd, value: `${fmtNum(s, lang, 3)} ${unit}`, raw: s, read: tt.rSd },
    { id: 'min', label: tt.min, value: `${fmtNum(lo.mean, lang, 4)} ${unit} (${lo.year})`, raw: lo.mean, read: tt.rMin },
    { id: 'max', label: tt.max, value: `${fmtNum(hi.mean, lang, 4)} ${unit} (${hi.year})`, raw: hi.mean, read: tt.rMax },
    { id: 'cv', label: tt.cv, value: cvOk ? `${fmtNum((s / Math.abs(m)) * 100, lang, 3)} %` : c.na, raw: cvOk ? (s / Math.abs(m)) * 100 : '', read: tt.rCv },
    { id: 'ac', label: tt.ac, value: fmtNum(t.autocorrelation, lang, 2), raw: t.autocorrelation, read: tt.rAc },
    { id: 'neff', label: tt.neff, value: fmtNum(t.n_effective, lang, 3), raw: t.n_effective, read: tt.rNeff },
  ]
  const descCols: Column<DescRow>[] = [
    { id: 'label', header: tt.descCols[0], cell: (r) => r.label, csv: (r) => r.label },
    { id: 'value', header: tt.descCols[1], align: 'right', cell: (r) => r.value, csv: (r) => r.raw },
    { id: 'read', header: tt.descCols[2], cell: (r) => <span className="muted">{r.read}</span>, csv: (r) => r.read },
  ]

  // --- (b) método comparativo
  const ci = (a: number, b: number) => `${fmtNum(a, lang)} ${c.to} ${fmtNum(b, lang)}`
  const delta = t.ols_slope_per_decade - t.slope_per_decade
  const methods: MethodRow[] = [
    {
      id: 'ts', name: tt.ts, slope: signed(t.slope_per_decade, lang), slopeRaw: t.slope_per_decade,
      ci: ci(t.ci_low_per_decade, t.ci_high_per_decade),
      p: `${fmtProb(t.mk_p, lang)} (τ = ${fmtNum(t.mk_tau, lang, 2)})`, pRaw: t.mk_p,
      read: t.mk_p < 0.05 ? tt.readSig : tt.readNo,
    },
    {
      id: 'ols', name: tt.ols, slope: signed(t.ols_slope_per_decade, lang), slopeRaw: t.ols_slope_per_decade,
      ci: ci(t.ols_ci_low_per_decade, t.ols_ci_high_per_decade),
      p: fmtProb(t.ols_p, lang), pRaw: t.ols_p,
      read: t.ols_p < 0.05 ? tt.readSig : tt.readNo,
    },
    {
      id: 'agree', name: tt.agree, slope: `${tt.delta.split(' ')[0]} ${signed(delta, lang)}`, slopeRaw: delta,
      ci: c.na, p: c.na, pRaw: null, read: t.methods_agree ? tt.agreeYes : tt.agreeNo, agree: true,
    },
  ]
  const methodCols: Column<MethodRow>[] = [
    { id: 'name', header: tt.methodCols[0], cell: (r) => r.name, csv: (r) => r.name },
    { id: 'slope', header: tt.methodCols[1], align: 'right', cell: (r) => r.slope, csv: (r) => r.slopeRaw },
    { id: 'ci', header: tt.methodCols[2], align: 'right', cell: (r) => r.ci, csv: (r) => r.ci },
    { id: 'p', header: tt.methodCols[3], align: 'right', cell: (r) => r.p, csv: (r) => r.pRaw },
    { id: 'read', header: tt.methodCols[4], cell: (r) => r.read, csv: (r) => r.read },
  ]

  // --- (c) datos por año con medias por década
  const fitted = new Map((t.series?.trend_line ?? []).map((p) => [p.year, p.mean]))
  const yearRows: YearRow[] = annual.map((p) => {
    const f = fitted.get(p.year)
    return { id: `y${p.year}`, kind: 'year', label: String(p.year), mean: p.mean, fitted: f ?? null, resid: f === undefined ? null : p.mean - f }
  })
  const rows: YearRow[] = []
  for (let i = 0; i < annual.length; i++) {
    rows.push(yearRows[i])
    const dec = Math.floor(annual[i].year / 10)
    const last = i === annual.length - 1 || Math.floor(annual[i + 1].year / 10) !== dec
    if (last) {
      const grp = yearRows.filter((y) => Math.floor(Number(y.label) / 10) === dec)
      const fit = grp.filter((y) => y.fitted !== null)
      rows.push({
        id: `d${dec}`, kind: 'decade',
        label: `${tt.decade} ${grp[0].label}–${grp[grp.length - 1].label}`,
        mean: mean(grp.map((y) => y.mean)),
        fitted: fit.length ? mean(fit.map((y) => y.fitted!)) : null,
        resid: fit.length ? mean(fit.map((y) => y.resid!)) : null,
      })
    }
  }
  const dig = 4
  const yearCols: Column<YearRow>[] = [
    { id: 'year', header: tt.dataCols[0], cell: (r) => r.label, csv: (r) => r.label },
    { id: 'mean', header: `${tt.dataCols[1]} (${unit})`, align: 'right', cell: (r) => fmtNum(r.mean, lang, dig), csv: (r) => r.mean },
    { id: 'fit', header: tt.dataCols[2], align: 'right', cell: (r) => (r.fitted === null ? c.na : fmtNum(r.fitted, lang, dig)), csv: (r) => r.fitted },
    { id: 'res', header: tt.dataCols[3], align: 'right', cell: (r) => (r.resid === null ? c.na : signed(r.resid, lang, 3)), csv: (r) => r.resid },
  ]

  return (
    <section className="stat-stack" aria-label={tt.title}>
      <SectionHead title={tt.title} sub={tt.sub} />

      {desc.length > 0 && (
        <div className="stat-sub">
          <h4 className="stat-sub-title">{tt.descTitle}</h4>
          <DataTable
            columns={descCols} rows={desc} rowKey={(r) => r.id} ariaLabel={tt.descTitle}
            csvName={`${tt.file}-descriptivos-${t.variable}`} csvLabel={c.csv}
          />
        </div>
      )}

      <div className="stat-sub">
        <h4 className="stat-sub-title">{tt.methodTitle}</h4>
        <DataTable
          columns={methodCols} rows={methods} rowKey={(r) => r.id} ariaLabel={tt.methodTitle}
          rowClass={(r) => (r.agree ? 'row-agree' : undefined)}
          csvName={`${tt.file}-metodos-${t.variable}`} csvLabel={c.csv}
        />
      </div>

      {rows.length > 0 && (
        <div className="stat-sub">
          <h4 className="stat-sub-title">{tt.dataTitle}</h4>
          <DataTable
            columns={yearCols} rows={rows} rowKey={(r) => r.id} ariaLabel={tt.dataTitle}
            sticky maxHeight={340} rowClass={(r) => (r.kind === 'decade' ? 'row-summary' : undefined)}
            csvRows={rows.filter((r) => r.kind === 'year')}
            csvName={`${tt.file}-por-anio-${t.variable}`} csvLabel={c.csv}
          />
        </div>
      )}
    </section>
  )
}

/** Tabla del escenario por año (valor y rango del 95 %). */
export function ScenarioTable({ forecast, unit, variable, lang }: { forecast: Forecast; unit: string; variable: string; lang: Lang }) {
  const c = TBL[lang]
  const tt = c.trend
  type R = Forecast['points'][number]
  const cols: Column<R>[] = [
    { id: 'year', header: tt.scenCols[0], cell: (r) => r.year, csv: (r) => r.year },
    { id: 'v', header: `${tt.scenCols[1]} (${unit})`, align: 'right', cell: (r) => fmtNum(r.value, lang, 4), csv: (r) => r.value },
    { id: 'lo', header: tt.scenCols[2], align: 'right', cell: (r) => fmtNum(r.low, lang, 4), csv: (r) => r.low },
    { id: 'hi', header: tt.scenCols[3], align: 'right', cell: (r) => fmtNum(r.high, lang, 4), csv: (r) => r.high },
  ]
  return (
    <div className="stat-sub">
      <h4 className="stat-sub-title">{tt.scenTitle}</h4>
      <DataTable
        columns={cols} rows={forecast.points} rowKey={(r) => String(r.year)} ariaLabel={tt.scenTitle}
        sticky maxHeight={280} csvName={`${tt.file}-escenario-${variable}`} csvLabel={c.csv}
      />
    </div>
  )
}

type AdvRow = { id: string; test: string; result: string; read: string }

/** Pruebas avanzadas del bloque de rigor: salto brusco, sensibilidad al periodo, p ajustado e interpretación. */
export function AdvancedTests({ trend: t, lang }: { trend: Trend; lang: Lang }) {
  const c = TBL[lang]
  const tt = c.trend
  const rows: AdvRow[] = [
    { id: 'step', test: tt.step, result: t.step_year ? `${tt.stepYes} ${t.step_year}` : tt.stepNone, read: tt.stepRead },
    { id: 'sens', test: tt.sens, result: t.period_sensitive ? tt.sensYes : tt.sensNo, read: tt.sensRead },
    { id: 'padj', test: tt.padj, result: t.p_adjusted === null ? tt.padjNA : fmtProb(t.p_adjusted, lang), read: tt.padjRead },
  ]
  const cols: Column<AdvRow>[] = [
    { id: 'test', header: tt.advCols[0], cell: (r) => r.test, csv: (r) => r.test },
    { id: 'result', header: tt.advCols[1], cell: (r) => r.result, csv: (r) => r.result },
    { id: 'read', header: tt.advCols[2], cell: (r) => <span className="muted">{r.read}</span>, csv: (r) => r.read },
  ]
  return (
    <div className="stat-sub">
      <h4 className="stat-sub-title">{tt.advTitle}</h4>
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} ariaLabel={tt.advTitle} />
      {t.interpretation && (
        <p className="small" style={{ margin: '10px 0 0' }}>
          <strong>{tt.interp}: </strong>{t.interpretation}
        </p>
      )}
    </div>
  )
}
