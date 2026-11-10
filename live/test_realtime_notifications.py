"""Art-chat event broadcasts stay ordered while isolating bad recipients."""
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

async def main():
    room={'members':{}}
    one=FakeSocket()
    two=FakeSocket(error=True)
    room['members']={one:{},two:{}}
    await notify(room,{'type':'begin','n':1})
    await asyncio.sleep(0)
    assert len(one.messages)==1 and two.closed
    room['members'].pop(two)
    await asyncio.gather(
        notify(room,{'type':'begin','n':2}),
        notify(room,{'type':'end','n':3}))
    assert ['"n":1','"n":2','"n":3']==[
        next(x for x in ['"n":1','"n":2','"n":3'] if x in item) for item in one.messages]
    print('PASS: art-chat ordered notifications and stale socket isolation')

asyncio.run(main())
