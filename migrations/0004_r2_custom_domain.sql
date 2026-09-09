UPDATE works
SET payload_json = replace(
  payload_json,
  'https://pub-e6a8f147577c403f93d85e03a6361345.r2.dev',
  'https://images.acedentshop.co.kr'
)
WHERE instr(
  payload_json,
  'https://pub-e6a8f147577c403f93d85e03a6361345.r2.dev'
) > 0;

UPDATE work_assets
SET public_url = replace(
  public_url,
  'https://pub-e6a8f147577c403f93d85e03a6361345.r2.dev',
  'https://images.acedentshop.co.kr'
)
WHERE instr(
  public_url,
  'https://pub-e6a8f147577c403f93d85e03a6361345.r2.dev'
) > 0;
