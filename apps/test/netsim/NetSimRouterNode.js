'use strict';
/* global describe */
/* global beforeEach */
/* global it */

var testUtils = require('../util/testUtils');
testUtils.setupLocale('netsim');
var assert = testUtils.assert;
var assertEqual = testUtils.assertEqual;
var assertOwnProperty = testUtils.assertOwnProperty;
var netsimTestUtils = require('../util/netsimTestUtils');
var fakeShard = netsimTestUtils.fakeShard;
var assertTableSize = netsimTestUtils.assertTableSize;

var NetSimLogger = testUtils.requireWithGlobalsCheckBuildFolder('netsim/NetSimLogger');
var NetSimRouterNode = testUtils.requireWithGlobalsCheckBuildFolder('netsim/NetSimRouterNode');
var NetSimLocalClientNode = testUtils.requireWithGlobalsCheckBuildFolder('netsim/NetSimLocalClientNode');
var NetSimWire = testUtils.requireWithGlobalsCheckBuildFolder('netsim/NetSimWire');
var Packet = testUtils.requireWithGlobalsCheckBuildFolder('netsim/Packet');
var NetSimMessage = testUtils.requireWithGlobalsCheckBuildFolder('netsim/NetSimMessage');
var netsimConstants = testUtils.requireWithGlobalsCheckBuildFolder('netsim/netsimConstants');
var dataConverters = testUtils.requireWithGlobalsCheckBuildFolder('netsim/dataConverters');
var intToBinary = dataConverters.intToBinary;
var DnsMode = netsimConstants.DnsMode;

describe("NetSimRouterNode", function () {
  var testShard;

  beforeEach(function () {
    NetSimLogger.getSingleton().setVerbosity(NetSimLogger.LogLevel.NONE);

    testShard = fakeShard();
  });

  it("has expected row structure and default values", function () {
    var router = new NetSimRouterNode(testShard);
    var row = router.buildRow_();

    assertOwnProperty(row, 'dnsMode');
    assertEqual(row.dnsMode, DnsMode.NONE);

    assertOwnProperty(row, 'dnsNodeID');
    assertEqual(row.dnsNodeID, undefined);

    assertOwnProperty(row, 'bandwidth');
    assertEqual(row.bandwidth, 'Infinity');
  });

  describe("constructing from a table row", function () {
    var router;
    var makeRouter = function (row) {
      return new NetSimRouterNode(testShard, row);
    };

    it ("dnsMode", function () {
      router = makeRouter({ dnsMode: DnsMode.AUTOMATIC });
      assertEqual(DnsMode.AUTOMATIC, router.dnsMode);
    });

    it ("dnsNodeID", function () {
      router = makeRouter({ dnsNodeID: 42 });
      assertEqual(42, router.dnsNodeID);
    });

    it ("bandwidth", function () {
      router = makeRouter({ bandwidth: 1024 });
      assertEqual(1024, router.bandwidth);

      // Special case: Bandwidth should be able to serialize in Infinity
      // from the string 'Infinity' in the database.
      router = makeRouter({ bandwidth: 'Infinity' });
      assertEqual(Infinity, router.bandwidth);
    });
  });

  describe("static method get", function () {
    var err, result, routerID;

    beforeEach(function () {
      err = undefined;
      result = undefined;
      routerID = 0;
    });

    it ("returns an Error object when router cannot be found", function () {
      NetSimRouterNode.get(routerID, testShard, function (_err, _result) {
        err = _err;
        result = _result;
      });

      assertEqual(null, result);
      assert(err instanceof Error, "Returned an error object");
      assertEqual('Not Found', err.message);
    });

    it ("returns null for error and a NetSimRouterNode when router is found", function () {
      NetSimRouterNode.create(testShard, function (_err, _router) {
        routerID = _router.entityID;
      });

      NetSimRouterNode.get(routerID, testShard, function(_err, _result) {
        err = _err;
        result = _result;
      });

      assertEqual(null, err);
      assert(result instanceof NetSimRouterNode);
      assertEqual(routerID, result.entityID);
    });
  });

  describe("getConnections", function () {
    var router;

    beforeEach(function () {
      NetSimRouterNode.create(testShard, function (err, newRouter) {
        router = newRouter;
      });
      assert(router !== undefined, "Made a router");
    });

    it ("returns an empty array when no wires are present", function () {
      var wires;
      router.getConnections(function (err, foundWires) {
        wires = foundWires;
      });
      assert(wires !== undefined, "Set wires");
      assertOwnProperty(wires, 'length');
      assertEqual(wires.length, 0);
    });

    it ("returns wires that have a remote end attached to the router", function () {
      NetSimWire.create(testShard, 0, router.entityID, function () {});

      var wires;
      router.getConnections(function (err, foundWires) {
        wires = foundWires;
      });
      assertEqual(wires.length, 1);
    });

    it ("returns NetSimWire objects", function () {
      NetSimWire.create(testShard, 0, router.entityID, function () {});

      var wires;
      router.getConnections(function (err, foundWires) {
        wires = foundWires;
      });
      assert(wires[0] instanceof NetSimWire, "Got a NetSimWire back");
    });

    it ("skips wires that aren't connected to the router", function () {
      NetSimWire.create(testShard, 0, router.entityID, function () {});
      NetSimWire.create(testShard, 0, router.entityID + 1, function () {});

      var wires;
      router.getConnections(function (err, foundWires) {
        wires = foundWires;
      });
      // Only get the one wire back.
      assertEqual(wires.length, 1);
    });
  });

  describe("acceptConnection", function () {
    var connectionLimit = 6;
    var router;

    beforeEach(function () {
      NetSimRouterNode.create(testShard, function (e, r) {
        router = r;
      });
    });

    it ("accepts connection if total connections are at or below limit", function () {
      for (var wireID = router.entityID + 1;
           wireID < router.entityID + connectionLimit + 1;
           wireID++) {
        NetSimWire.create(testShard, wireID, router.entityID, function () {});
      }
      assertTableSize(testShard, 'wireTable', connectionLimit);

      var accepted;
      router.acceptConnection(null, function (err, isAccepted) {
        accepted = isAccepted;
      });

      assertEqual(true, accepted);
    });

    it ("rejects connection if total connections are beyond limit", function () {
      for (var wireID = router.entityID + 1;
           wireID < router.entityID + connectionLimit + 2;
           wireID++) {
        NetSimWire.create(testShard, wireID, router.entityID, function () {});
      }
      assertTableSize(testShard, 'wireTable', connectionLimit + 1);

      var accepted;
      router.acceptConnection(null, function (err, isAccepted) {
        accepted = isAccepted;
      });

      assertEqual(false, accepted);
    });
  });

  describe("message routing rules", function () {
    var router, localClient, remoteA, encoder;

    beforeEach(function () {
      // Spec reversed in test vs production to show that it's flexible
      var packetHeaderSpec = [
        {key: Packet.HeaderType.FROM_ADDRESS, bits: 4},
        {key: Packet.HeaderType.TO_ADDRESS, bits: 4}
      ];
      encoder = new Packet.Encoder(packetHeaderSpec);

      // Make router
      NetSimRouterNode.create(testShard, function (e, r) {
        router = r;
      });

      // Make clients
      NetSimLocalClientNode.create(testShard, function (e, n) {
        localClient = n;
      });

      NetSimLocalClientNode.create(testShard, function (e, n) {
        remoteA = n;
      });

      // Tell router to simulate for local node
      router.initializeSimulation(localClient.entityID, packetHeaderSpec);

      // Manually connect nodes
      var wire;
      NetSimWire.create(testShard, localClient.entityID, router.entityID, function(e, w) {
        wire = w;
      });
      wire.localAddress = 1;
      wire.remoteAddress = 0;
      wire.update();

      NetSimWire.create(testShard, remoteA.entityID, router.entityID, function (e, w) {
        wire = w;
      });
      wire.localAddress = 2;
      wire.remoteAddress = 0;
      wire.update();

      var addressTable = router.getAddressTable();
      assertEqual(addressTable.length, 2);
      assertEqual(addressTable[0].isLocal, true);
      localClient.address = addressTable[0].address;
      remoteA.address = addressTable[1].address;

      // Make sure router initial time is zero
      router.tick({time: 0});
    });

    it ("ignores messages sent to itself from other clients", function () {
      var from = remoteA.entityID;
      var to = router.entityID;
      NetSimMessage.send(testShard, from, to, 'garbage', function () {});
      assertTableSize(testShard, 'logTable', 0);

      var messages;
      testShard.messageTable.readAll(function (err, rows) {
        messages = rows.map(function (row) {
          return new NetSimMessage(testShard, row);
        });
      });
      assertEqual(messages[0].fromNodeID, from);
      assertEqual(messages[0].toNodeID, to);
    });

    it ("ignores messages sent to others", function () {
      var from = localClient.entityID;
      var to = remoteA.entityID;
      NetSimMessage.send(testShard, from, to, 'garbage', function () {});
      assertTableSize(testShard, 'messageTable', 1);
      assertTableSize(testShard, 'logTable', 0);

      var messages;
      testShard.messageTable.readAll(function (err, rows) {
        messages = rows.map(function (row) {
          return new NetSimMessage(testShard, row);
        });
      });
      assertEqual(messages[0].fromNodeID, from);
      assertEqual(messages[0].toNodeID, to);
    });

    it ("does not forward malformed packets", function () {
      var from = localClient.entityID;
      var to = router.entityID;
      // Here, the payload gets 'cleaned' down to empty string, then treated
      // as zero when parsing the toAddress.
      NetSimMessage.send(testShard, from, to, 'garbage', function () {});

      // Router must tick to process messages; 1000ms is sufficient time for
      // a short packet.
      router.tick({time: 1000});

      assertTableSize(testShard, 'messageTable', 0);
      assertTableSize(testShard, 'logTable', 1);
    });

    it ("does not forward packets with no match in the local network", function () {
      var fromNodeID = localClient.entityID;
      var toNodeID = router.entityID;

      var payload = encoder.concatenateBinary({
        toAddress: '1111',
        fromAddress: '1111'
      }, 'messageBody');

      NetSimMessage.send(testShard, fromNodeID, toNodeID, payload, function () {});

      // Router must tick to process messages; 1000ms is sufficient time for
      // a short packet.
      router.tick({time: 1000});

      assertTableSize(testShard, 'messageTable', 0);
      assertTableSize(testShard, 'logTable', 1);
    });

    it ("forwards packets when the toAddress is found in the network", function () {
      var fromNodeID = localClient.entityID;
      var toNodeID = router.entityID;
      var fromAddress = localClient.address;
      var toAddress = remoteA.address;

      var payload = encoder.concatenateBinary({
        toAddress: intToBinary(toAddress, 4),
        fromAddress: intToBinary(fromAddress, 4)
      }, 'messageBody');

      NetSimMessage.send(testShard, fromNodeID, toNodeID, payload, function () {});

      // Router must tick to process messages; 1000ms is sufficient time for
      // a short packet.
      router.tick({time: 1000});

      assertTableSize(testShard, 'messageTable', 1);
      assertTableSize(testShard, 'logTable', 1);

      // Verify that message from/to node IDs are correct
      var messages;
      testShard.messageTable.readAll(function (err, rows) {
        messages = rows.map(function (row) {
          return new NetSimMessage(testShard, row);
        });
      });
      assertEqual(messages[0].fromNodeID, router.entityID);
      assertEqual(messages[0].toNodeID, remoteA.entityID);
    });

    describe("Router bandwidth limits", function () {
      var fromNodeID, toNodeID, fromAddress, toAddress;

      var sendMessageOfSize = function (messageSizeBits) {
        var payload = encoder.concatenateBinary({
          toAddress: intToBinary(toAddress, 4),
          fromAddress: intToBinary(fromAddress, 4)
        }, '0'.repeat(messageSizeBits - 8));

        NetSimMessage.send(testShard, fromNodeID, toNodeID, payload, function () {});
      };

      beforeEach(function () {
        fromNodeID = localClient.entityID;
        toNodeID = router.entityID;
        fromAddress = localClient.address;
        toAddress = remoteA.address;

        // Establish time baseline of zero
        router.tick({time: 0});
        assertTableSize(testShard, 'logTable', 0);
      });

      it ("requires variable time to forward packets based on bandwidth", function () {
        router.bandwidth = 1000; // 1 bit / ms

        // Router detects message immediately, but does not send it until
        // enough time has passed to send the message based on bandwidth
        sendMessageOfSize(1008);

        // Message still has not been sent at 1007ms
        router.tick({time: 1007});
        assertTableSize(testShard, 'logTable', 0);

        // At 1000bps, it should take 1008ms to send 1008 bits
        router.tick({time: 1008});
        assertTableSize(testShard, 'logTable', 1);
      });

      it ("respects bandwidth setting", function () {
        // 0.1 bit / ms, so 10ms / bit
        router.bandwidth = 100;

        // This message should be sent at t=200
        sendMessageOfSize(20);

        // Message is sent at t=200
        router.tick({time: 199});
        assertTableSize(testShard, 'logTable', 0);
        router.tick({time: 200});
        assertTableSize(testShard, 'logTable', 1);
      });

      it ("routes packet on first tick if bandwidth is infinite", function () {
        router.bandwidth = Infinity;

        // Message is detected immediately, though that's not obvious here.
        sendMessageOfSize(1008);

        // At infinite bandwidth, router forwards message even though zero
        // time has passed.
        router.tick({time: 0});
        assertTableSize(testShard, 'logTable', 1);
      });

      it ("routes 'batches' of packets when multiple packets fit in the bandwidth", function () {
        router.bandwidth = 1000; // 1 bit / ms

        // Router should schedule these all as soon as they show up, for
        // 40, 80 and 120 ms respectively (due to the 0.1 bit per ms rate)
        sendMessageOfSize(40);
        sendMessageOfSize(40);
        sendMessageOfSize(40);

        // On this tick, two messages should get forwarded because enough
        // time has passed for them both to be sent given our current bandwidth.
        router.tick({time: 80});
        assertTableSize(testShard, 'logTable', 2);

        // On this final tick, the third message should be sent
        router.tick({time: 120});
        assertTableSize(testShard, 'logTable', 3);
      });

      it ("is pessimistic when scheduling new packets", function () {
        router.bandwidth = 1000; // 1 bit / ms

        // Router 'starts sending' this message now, expected to finish
        // at t=40
        sendMessageOfSize(40);

        // At t=30, we do schedule another message
        // You might think this one is scheduled for t=80, but because
        // we can't see partial progress from other clients we assume the
        // worst and schedule it for t=110 (30 + 40 + 40)
        router.tick({time: 30});
        sendMessageOfSize(40);

        // At t=40, the first message is sent
        router.tick({time: 39});
        assertTableSize(testShard, 'logTable', 0);
        router.tick({time: 40});
        assertTableSize(testShard, 'logTable', 1);

        // At t=110, the second message is sent
        router.tick({time: 109});
        assertTableSize(testShard, 'logTable', 1);
        router.tick({time: 110});
        assertTableSize(testShard, 'logTable', 2);
      });
    });
  });

});
