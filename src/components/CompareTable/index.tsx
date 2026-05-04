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
      <table className={styles.compareTable}>
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col" className={styles.brand}>AgentFlow</th>
            <th scope="col">{competitorName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.dimension}>
              <th scope="row" className={styles.dim}>{row.dimension}</th>
              <td
                className={
                  row.emphasis === 'agentflow' ? styles.cellWin : undefined
                }
              >
                {row.agentflow}
              </td>
              <td
                className={
                  row.emphasis === 'competitor' ? styles.cellWin : undefined
                }
              >
                {row.competitor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
