import cron from 'node-cron';
import { env } from '../config/env.js';
import { Report } from '../models/report.model.js';
import { emitReportUpdated } from '../realtime/socket.js';

export async function escalateOldReports(): Promise<number> {
  // TODO V6 CRON 1
  // Calcula el threshold usando REPORT_ESCALATION_MINUTES. Después consulta los
  // Reports OPEN creados antes o en ese threshold. Por cada Report, cambia el
  // status a ESCALATED, guarda el cambio y emite report:updated con el helper
  // existente. La función debe regresar el número de Reports escalados.
  const threshold = new Date(Date.now() - env.reportEscalationMinutes * 60 * 1000);
  const reports = await Report.find({ status: 'OPEN', createdAt: { $lte: threshold } });

  for (const report of reports) {
    report.status = 'ESCALATED';
    await report.save();
    await report.populate([
      { path: 'channelId', select: 'name' },
      { path: 'userId', select: 'email' }
    ]);
    const user = report.userId as unknown as { _id: { toString(): string } };
    emitReportUpdated(user._id.toString(), report.toObject());
  }

  return reports.length;
}

export function startReportEscalationJob(): void {
  // TODO V6 CRON 2
  // Programa la ejecución periódica de escalateOldReports() usando node-cron y
  // env.reportEscalationCron. Controla los errores para que una falla del job
  // no detenga el servidor.
  cron.schedule(env.reportEscalationCron, async () => {
    try {
      const count = await escalateOldReports();
      if (count > 0) console.log(`Reports escalated: ${count}`);
    } catch (error) {
      console.error('Report escalation job failed:', error);
    }
  });
  console.log(`Report escalation job scheduled: ${env.reportEscalationCron}`);
}
