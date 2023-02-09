import { ethers } from 'hardhat';
import { expect } from 'chai';

const deploySafe = async () => {
  const members = await ethers.getSigners().then(s => s.slice(0, 3));

  const safeFactory = await ethers.getContractFactory('FamilySafe');
  const safe = await safeFactory.deploy(members.map(m => m.address));

  return { safe, members };
};

describe('Safe', () => {
  it('adds initial family members', async () => {
    const { safe, members } = await deploySafe();

    for (const member of members) {
      expect(await safe.isFamilyMember(member.address)).to.be.true;
    }
  });

  it('receives deposits and emits event from family member', async () => {
    const { safe } = await deploySafe();

    const [sender] = await ethers.getSigners();
    expect(await safe.isFamilyMember(sender.address)).to.be.true;

    const amount = ethers.utils.parseEther('0.1');

    const tx = await sender.sendTransaction({
      to: safe.address,
      value: amount
    });

    const receipt = await tx.wait();

    const event = receipt.logs[0];

    const decodedEvent = safe.interface.decodeEventLog('Deposit', event.data, event.topics);

    expect(decodedEvent['sender']).eq(sender.address);
    expect(decodedEvent['time']).lte(await ethers.provider.getBlock('latest').then(b => b.timestamp));
    expect(decodedEvent['amount']).eq(amount);

    // check contract balance
    expect(await ethers.provider.getBalance(safe.address)).to.eq(amount);
  });

  it('receives deposits and emits event from non family member', async () => {
    const { safe } = await deploySafe();

    const sender = await ethers.getSigners().then(s => s[4]);
    expect(await safe.isFamilyMember(sender.address)).to.be.false;

    const amount = ethers.utils.parseEther('0.1');

    const tx = await sender.sendTransaction({
      to: safe.address,
      value: amount
    });

    const receipt = await tx.wait();

    const event = receipt.logs[0];

    const decodedEvent = safe.interface.decodeEventLog('Deposit', event.data, event.topics);

    expect(decodedEvent['sender']).eq(sender.address);
    expect(decodedEvent['time']).lte(await ethers.provider.getBlock('latest').then(b => b.timestamp));
    expect(decodedEvent['amount']).eq(amount);

    // check contract balance
    expect(await ethers.provider.getBalance(safe.address)).to.eq(amount);
  });

  it('allows family members to withdraw', async () => {
    const { safe, members } = await deploySafe();

    const sender = await ethers.getSigners().then(signers => signers[4]);

    await sender
      .sendTransaction({
        to: safe.address,
        value: ethers.utils.parseEther('0.1')
      })
      .then(tx => tx.wait());

    const receiver = members[1];
    const amount = ethers.utils.parseEther('0.05');

    const tx = await safe.connect(receiver).withdraw(receiver.address, amount);
    const receipt = await tx.wait();
    const { args } = receipt.events![0];

    expect(args!['receiver']).eq(receiver.address);
    expect(args!['time']).lte(await ethers.provider.getBlock('latest').then(b => b.timestamp));
    expect(args!['amount']).eq(amount);
    expect(await ethers.provider.getBalance(safe.address)).to.eq(ethers.utils.parseEther('0.05'));
  });

  it("doesn't allow others to withdraw", async () => {
    const { safe } = await deploySafe();

    const sender = await ethers.getSigners().then(signers => signers[4]);

    await sender
      .sendTransaction({
        to: safe.address,
        value: ethers.utils.parseEther('0.1')
      })
      .then(tx => tx.wait());

    const receiver = await ethers.getSigners().then(signers => signers[7]);
    const amount = ethers.utils.parseEther('0.05');

    expect(safe.connect(receiver).withdraw(receiver.address, amount)).revertedWith('Only family members');
    expect(await ethers.provider.getBalance(safe.address)).to.eq(ethers.utils.parseEther('0.1'));
  });

  it('adds a new family member', async () => {
    const { safe } = await deploySafe();

    const newMember = await ethers.getSigners().then(signers => signers[3]);
    const tx = await safe.addFamilyMember(newMember.address);
    const receipt = await tx.wait();
    const { args } = receipt.events![0];

    expect(args!['member']).eq(newMember.address);
    expect(await safe.isFamilyMember(newMember.address)).to.be.true;
  });

  it("doesn't allow non family members to add new family members", async () => {
    const { safe } = await deploySafe();

    const newMember = await ethers.getSigners().then(signers => signers[3]);
    const sender = await ethers.getSigners().then(signers => signers[4]);

    await expect(safe.connect(sender).addFamilyMember(newMember.address)).to.be.revertedWith('Only family members');
  });

  it("doesn't allow to withdraw insufficient funds", async () => {
    const { safe, members } = await deploySafe();

    const sender = await ethers.getSigners().then(signers => signers[4]);
    const amount = ethers.utils.parseEther('0.1');

    await sender
      .sendTransaction({
        to: safe.address,
        value: amount
      })
      .then(tx => tx.wait());

    const receiver = members[1];

    await expect(safe.connect(receiver).withdraw(receiver.address, amount.add(1))).to.be.revertedWith(
      'Insufficient funds'
    );
  });

  it('allows to withdraw all funds', async () => {
    const { safe, members } = await deploySafe();

    const sender = await ethers.getSigners().then(signers => signers[4]);
    const amount = ethers.utils.parseEther('0.1');

    await sender
      .sendTransaction({
        to: safe.address,
        value: amount
      })
      .then(tx => tx.wait());

    const receiver = members[1];

    const tx = await safe.connect(receiver).withdrawAll();
    const receipt = await tx.wait();
    const { args } = receipt.events![0];

    expect(args!['receiver']).eq(receiver.address);
    expect(args!['time']).lte(await ethers.provider.getBlock('latest').then(b => b.timestamp));
    expect(args!['amount']).eq(amount);
    expect(await ethers.provider.getBalance(safe.address)).to.eq(0);
  });

  it('allows to withdraw all without funds', async () => {
    const { safe, members } = await deploySafe();

    const receiver = members[1];

    const tx = await safe.connect(receiver).withdrawAll();
    const receipt = await tx.wait();
    const { args } = receipt.events![0];

    expect(args!['receiver']).eq(receiver.address);
    expect(args!['time']).lte(await ethers.provider.getBlock('latest').then(b => b.timestamp));
    expect(args!['amount']).eq(0);
    expect(await ethers.provider.getBalance(safe.address)).to.eq(0);
  });

  it("doesn't allow others to withdraw all funds", async () => {
    const { safe } = await deploySafe();

    const sender = await ethers.getSigners().then(signers => signers[4]);
    const amount = ethers.utils.parseEther('0.1');

    await sender
      .sendTransaction({
        to: safe.address,
        value: amount
      })
      .then(tx => tx.wait());

    const receiver = await ethers.getSigners().then(signers => signers[7]);

    expect(safe.connect(receiver).withdrawAll()).revertedWith('Only family members');
    expect(await ethers.provider.getBalance(safe.address)).to.eq(amount);
  });
});
