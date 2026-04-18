#coding=utf-8
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

'''
获取数据库连接
return 数据库连接
'''
def getConnection(host, port, dbname, user, password, schema=None):
    engine = create_engine('postgresql://'+user+':'+password+'@'+host+':'+str(port)+'/'+dbname, poolclass=NullPool)
    conn = engine.connect()
    # SQLAlchemy 2.0+ 要求可执行语句须用 text() 包装，不能传裸字符串
    if schema is not None:
        conn.execute(text("SET search_path TO " + str(schema)))
    return conn


def closeConnection(conn):
    if(conn != None):
        conn.close()

'''
查询
conn: 数据库连接
sql: 查询语句
return pd.DataFrame
'''
def query(conn, sql):
    return pd.read_sql_query(sql, con=conn)

'''
将dataFrame插入到数据库
conn: 数据库连接
tableName: 目标表
dataFrame: 要插入的数据框
'''
def dbWriteTable(conn, tableName, dataFrame):
    # 非 DataFrame 时旧逻辑静默跳过，会导致「节点成功但无临时表」；建议 execute 始终 return DataFrame
    if isinstance(dataFrame, pd.DataFrame) == False:
        return
    dataFrame.to_sql(tableName, index=False, if_exists='replace', con=conn)
    # SQLAlchemy 2.x：to_sql 在同一事务中，若不 commit，close(conn) 时会回滚，表将不会真正创建
    if hasattr(conn, "commit"):
        conn.commit()

'''
修改类型
conn:数据库连接
tableName:目标表
dataFrame:要修改的表
Type:修改类型为
'''
def modifyType(conn, tableName, dataFrame, type_dict):
    if isinstance(dataFrame, pd.DataFrame) == False:
        return
    dataFrame.to_sql(tableName, index=False, if_exists='replace',con=conn,dtype=type_dict)
    if hasattr(conn, "commit"):
        conn.commit()



