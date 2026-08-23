import { createStudyServer } from './server-lib.mjs';

const port = Number(process.env.NEUROSCAPE_STUDY_PORT ?? 8787);
const server = createStudyServer();
server.listen(port, '127.0.0.1', () => {
  console.log(`NeuroScape study recorder: http://127.0.0.1:${port}`);
  console.log(
    `Results directory: ${process.env.NEUROSCAPE_RESULTS_DIR ?? 'study-results'}`,
  );
});
