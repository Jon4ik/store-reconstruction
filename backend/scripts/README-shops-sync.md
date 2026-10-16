# Синхронизация справочника магазинов

Справочник копируется из SQL Server Ukm_Data.dbo.v_1C_Shops_Info в таблицу PostgreSQL shop_directory. Записи, отсутствующие в источнике, не удаляются. Для существующих магазинов обновляются только отличающиеся поля.

Добавьте в backend/.env или окружение контейнера:
- UKM_SQL_SERVER — сервер SQL Server (hostname/IP без порта)
- UKM_SQL_PORT=1433
- UKM_SQL_DATABASE — база данных источника
- UKM_SQL_USER
- UKM_SQL_PASSWORD
- UKM_SQL_VIEW=[Ukm_Data].[dbo].[v_1C_Shops_Info] (необязательно, если представление отличается)
- PYTHON_EXECUTABLE=python3 (на Windows обычно python)

На сервере API нужны Python 3, Microsoft ODBC Driver for SQL Server и пакет pyodbc (python -m pip install pyodbc). Учётные данные не сохраняются в PostgreSQL и не возвращаются браузеру.

После миграции администратор может открыть «Справочник → Магазины» и запустить синхронизацию вручную. Планировщик по умолчанию включает ежедневный запуск 0 0 * * * в локальном часовом поясе сервера; в настройках можно отключить задачу или изменить crontab-выражение.
