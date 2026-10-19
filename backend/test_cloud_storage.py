import os
import sqlite3
import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from backend import storage


class CloudStorageTests(unittest.TestCase):
    def test_vercel_never_falls_back_to_local_file(self):
        with patch.dict(os.environ, {'VERCEL':'1','DATABASE_URL':'','POSTGRES_URL':'','OPTILOAD_DB_PATH':'/tmp/not-persistent.db'}):
            with self.assertRaises(HTTPException) as error: storage.connect()
            self.assertEqual(error.exception.status_code,503)
            self.assertIn('DATABASE_URL',error.exception.detail)

    def test_postgres_uses_tls_transactions_and_parameterized_queries(self):
        driver=MagicMock()
        raw=driver.connect.return_value
        with patch.dict(os.environ, {'VERCEL':'1','DATABASE_URL':'postgresql://example.invalid/db','POSTGRES_URL':''}), patch.object(storage,'psycopg',driver):
            db=storage.connect()
            driver.connect.assert_called_once()
            self.assertEqual(driver.connect.call_args.kwargs['sslmode'],'require')
            self.assertIsNone(driver.connect.call_args.kwargs['prepare_threshold'])
            self.assertTrue(raw.commit.called)
            with db:
                db.execute('SELECT * FROM layouts WHERE id = ?', ("' OR 1=1 --",))
            raw.execute.assert_called_with('SELECT * FROM layouts WHERE id = %s', ("' OR 1=1 --",))
            self.assertTrue(raw.__exit__.called)
            db.close()
            self.assertTrue(raw.close.called)

    def test_postgres_connection_failure_does_not_create_sqlite(self):
        driver=MagicMock()
        driver.connect.side_effect=sqlite3.OperationalError('sensitive connection details')
        with patch.dict(os.environ, {'DATABASE_URL':'postgresql://example.invalid/db'}), patch.object(storage,'psycopg',driver), patch.object(storage.sqlite3,'connect') as local:
            with self.assertRaises(HTTPException) as error: storage.connect()
            self.assertNotIn('sensitive',error.exception.detail)
            local.assert_not_called()

    def test_vercel_rejects_unencrypted_connection(self):
        with patch.dict(os.environ, {'VERCEL':'1','DATABASE_URL':'postgresql://example.invalid/db?sslmode=disable'}), patch.object(storage,'psycopg',MagicMock()):
            with self.assertRaises(HTTPException) as error: storage.connect()
            self.assertIn('TLS',error.exception.detail)

    def test_provider_alias(self):
        with patch.dict(os.environ, {'DATABASE_URL':'','POSTGRES_URL':'postgresql://example.invalid/db'}):
            self.assertEqual(storage.database_url(),'postgresql://example.invalid/db')


if __name__ == '__main__': unittest.main()
