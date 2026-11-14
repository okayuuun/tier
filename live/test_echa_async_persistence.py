"""Large art snapshots must not block live WebSocket processing."""
import asyncio
import time
from unittest.mock import patch
from room_store import RoomStore


class FakeConn:
    def __init__(self):
        self.values=[]
    async def execute(self, statement, *args):
        self.values.append(args)


class FakePool:
    def __init__(self):
        self.connection=FakeConn()
    def acquire(self):
        return self
    async def __aenter__(self):
        return self.connection
    async def __aexit__(self, *exc):
        return False


async def main():
    store=RoomStore('')
    store.pool=FakePool()
    room={'code':'TEST42','members':{},'strokes':[{'id':'first'}],
          'notifyLock':asyncio.Lock(), '_artOutgoing':{}}
    snapshots=[]
    def slow_compression(kind, immutable_snapshot):
        assert kind=='art'
        time.sleep(.27)
        snapshots.append(immutable_snapshot)
        return b'compressed-dummy'

    with patch('room_store.serialize_room', slow_compression):
        work=asyncio.create_task(store._write_one(('art','TEST42'),3,room))
        await asyncio.sleep(.07)
        assert not work.done(), 'Compression should be running separately'
        # Main loop must have progressed BEFORE the compression completed.
        room['strokes'].append({'id':'second'})
        await asyncio.wait_for(work,2)
    assert len(snapshots)==1
    assert snapshots[0]['strokes']==[{'id':'first'}], (
        'Snapshot must be frozen before handing it to the worker')
    assert '_artOutgoing' not in snapshots[0]
    assert 'notifyLock' not in snapshots[0]
    assert store.pool.connection.values[0][3]==b'compressed-dummy'
    print('PASS: heavyweight art serialization runs off event loop with safe snapshot')


if __name__ == '__main__':
    asyncio.run(main())
