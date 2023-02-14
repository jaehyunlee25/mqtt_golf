insert into 
    log_report
values(
    uuid(),
    '${macroId}',
    '${deviceId}',
    '${clubId}',
    '${device}',
    '${type}',
    '${result}',
    '${others}',
    now(),
    now()
);
