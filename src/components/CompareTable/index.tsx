import type {ReactNode} from 'react';
import styles from './styles.module.css';

export type CompareRow = {
  dimension: string;
  agentflow: ReactNode;
  competitor: ReactNode;
  emphasis?: 'agentflow' | 'competitor' | 'tie';
};

type Props = {
  competitorName: string;
  rows: CompareRow[];
  caption?: string;
};

export default function CompareTable({competitorName, rows, caption}: Props) {
  return (
    <div className={styles.tableWrap}>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
      <div className={styles.tableScroll}>
        <table className={styles.compareTable}>
          <thead>
            <tr>
              <th scope="col" className={styles.dimHead}>Dimension</th>
              <th scope="col" className={styles.brand}>
                <span className={styles.brandDot} aria-hidden="true" />
                AgentFlow
              </th>
              <th scope="col" className={styles.competitor}>{competitorName}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const afWin = row.emphasis === 'agentflow';
              const compWin = row.emphasis === 'competitor';
              return (
                <tr key={row.dimension}>
                  <th scope="row" className={styles.dim}>{row.dimension}</th>
                  <td className={`${styles.cell} ${afWin ? styles.cellWin : ''}`}>
                    {afWin ? <span className={styles.winMark} aria-label="advantage">▲</span> : null}
                    <span>{row.agentflow}</span>
                  </td>
                  <td className={`${styles.cell} ${compWin ? styles.cellWin : ''}`}>
                    {compWin ? <span className={styles.winMark} aria-label="advantage">▲</span> : null}
                    <span>{row.competitor}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
