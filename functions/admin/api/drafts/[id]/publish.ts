import { json } from '../../../../_shared/admin';
import {
  DraftError,
  draftHandler,
  draftRecord,
  readDraft,
} from '../../../../_shared/work-drafts';
import {
  attachDraftDeployment,
  checkDraftDeployment,
  publishDraft,
  requestDraftDeployment,
} from '../../../../_shared/draft-publication';

export const onRequestGet = draftHandler(async (_request, env, id) =>
  json(await draftRecord(env, await checkDraftDeployment(env, id))),
);
export const onRequestPost = draftHandler(async (request, env, id, email) => {
  const input = (await request.json()) as {
    version: number;
    action?: string;
    deploymentId?: string;
    confirmed?: boolean;
  };
  const row = await readDraft(env, id);
  if (row.version !== input.version)
    throw new DraftError(
      '검토한 버전이 변경되었습니다. 다시 열어 주세요.',
      409,
    );
  if (input.confirmed !== true)
    throw new DraftError('저장된 미리보기를 확인한 뒤 발행해 주세요.');
  if (
    input.action !== undefined &&
    !['publish', 'attach', 'retry-deploy'].includes(input.action)
  )
    throw new DraftError('발행 요청 종류를 확인하세요.');
  if (input.action === 'attach')
    await attachDraftDeployment(env, id, input.deploymentId || '');
  else if (input.action === 'retry-deploy')
    await requestDraftDeployment(env, id, true);
  else {
    await publishDraft(env, id, input.version, email);
    await requestDraftDeployment(env, id);
  }
  return json(await draftRecord(env, await readDraft(env, id)), 202);
});
