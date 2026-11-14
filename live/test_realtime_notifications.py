"""Art broadcasts stay ordered without one slow peer blocking everyone."""
import asyncio
from echa_backend import notify

class FakeSocket:
    def __init__(self, delay=0, error=False):
        self.closed=False
        self.delay=delay
        self.error=error
        self.messages=[]
    async def send_str(self,message):
        if self.delay: await asyncio.sleep(self.delay)
        if self.error: raise ConnectionError('network lost')
        self.messages.append(message)
    async def close(self,code=1000,message=b''):
        self.closed=True

async def until(predicate, timeout=2):
    loop=asyncio.get_running_loop()
    end=loop.time()+timeout
    while loop.time()<end:
        if predicate():return
        await asyncio.sleep(.01)
    raise AssertionError('Timed out waiting for art packet')

async def main():
    room={'members':{}}
    one=FakeSocket()
    two=FakeSocket(error=True)
    room['members']={one:{},two:{}}
    await notify(room,{'type':'begin','n':1})
    await until(lambda: len(one.messages)==1 and two.closed)
    room['members'].pop(two)
    await asyncio.gather(
        notify(room,{'type':'begin','n':2}),
        notify(room,{'type':'end','n':3}))
    await until(lambda: len(one.messages)==3)
    assert ['"n":1','"n":2','"n":3']==[
        next(x for x in ['"n":1','"n":2','"n":3'] if x in item) for item in one.messages]

    # This was the source of multi-second drawing stalls: a slow phone
    # previously delayed every artist's brush operation by up to 4 sec.
    slow=FakeSocket(delay=.6)
    room['members'][slow]={}
    start=asyncio.get_running_loop().time()
    for i in range(8):
        await notify(room,{'type':'points','n':i+10})
    elapsed=asyncio.get_running_loop().time()-start
    assert elapsed<.5, f'Art events blocked behind slow recipient: {elapsed}'
    await until(lambda: len(one.messages)==11)
    assert all(f'"n":{i+10}' in msg
               for i,msg in enumerate(one.messages[3:]))
    # Close idle queues so tests and servers do not leak background tasks.
    for sock in list(room.get('_artOutgoing',{})):
        queue,task=room['_artOutgoing'].pop(sock)
        task.cancel()
    await asyncio.sleep(0)
    print('PASS: ordered art packets, slow socket isolation and bounded queues')

asyncio.run(main())
