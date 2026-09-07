// "npx expo start --dev-client"
import React, { useRef, useState, useEffect } from 'react';
import { View, Button, Image, StyleSheet, Text, TextInput, PermissionsAndroid, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BleManager, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

export default function App() {
//bt é runtime, precisa dar a permissao e dps roda continua
  async function requestBluetoothPermission() {
    if (Platform.OS !== 'android') {
      return true;
    }

    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      return (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Permissão de localização',
        message:
          'O aplicativo precisa dessa permissão para encontrar dispositivos Bluetooth.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Cancelar',
      }
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  const manager = useRef(null);

  useEffect(() => {
    manager.current = new BleManager();

    return () => {
      manager.current?.destroy();
      manager.current = null;
    };
  }, []);

  const cameraRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [resultado, setResultado] = useState("");
  const chunksRef = useRef([]);
  const respostaESP = useRef(null);
  const [numero, setNumero] = useState("");

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>precisa de permissão</Text>
        <Button title="Dar permissao" onPress={requestPermission} />
      </View>
    );
  }

  // IDs do dispositivo Bluetooth
  // device é um objeto pra eu achar o id dele

  //função que acha o id DO esp pra ficar legal, isso aqui foi facil :D
  async function encontrarESP() {
    return new Promise((resolve, reject) => {
      if (!manager.current) {
        reject(new Error("BleManager não foi inicializado"));
        return;
      }

      let dispositivosEncontrados = [];

      const timeout = setTimeout(() => {
        manager.current?.stopDeviceScan();

        console.log("SCAN FINALIZADO");
        console.log("DISPOSITIVOS ENCONTRADOS:", dispositivosEncontrados);

        reject(new Error("ESP32 não encontrado"));
      }, 10000);

      manager.current.startDeviceScan(
        null,
        null,
        (error, device) => {
          if (error) {
            clearTimeout(timeout);
            manager.current?.stopDeviceScan();

            console.log("ERRO NO SCAN:", error);

            reject(error);
            return;
          }

          if (device) {
            console.log(
              "DEVICE:",
              device.name,
              device.localName,
              device.id
            );

            dispositivosEncontrados.push({
              name: device.name,
              localName: device.localName,
              id: device.id,
            });
          }
        }
      );
    });
  }



  const serviceUUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  const writeCharacteristicUUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
  const notifyCharacteristicUUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";


  // aqui vem uma parte HORRIVEL desse codigo, é melhor cortar a imagem em pedaços doq mandar 1 inte
  //ira por bt, o bt tem uma capacidade limitada de data transfer, então mandar tintin por tintin
  //vai ser mais eficiente e tem uma chance quase nula de perder pedaços da foto, por mais que isso
  //seja um SACO de fazer pq vai ter q fazer concatenação e é capaz do bt do esp e da biblioteca do
  //mesmo limitarem essa capacidade de data transfer, então eu posso ter que fazer mais ou menos
  //"cortes" da foto e mais ou menos concatenções do codigo do esp
  //eu nao sou pago o suficiente pra isso :(

  //aqui eu defini a quantidade de caracteres que vai em cada corte, eu prefiro 50 pq eu n fiz tes
  //tes (dia 21/08) e nao quero fazer pra ficar mudando codigo toda santa hora eu n aguento maissss

  //aqui eu fiz uma função que espera conexão do bt, ele tenta conectar e le o estado da conexão
  //se conexão ta daora, nao tem problema, else catch erro

async function connectBt() {
  try {

    // Primeiro garante que o aplicativo tem permissão para usar Bluetooth
    const permissionGranted = await requestBluetoothPermission();

    console.log("PERMISSÃO BLUETOOTH:", permissionGranted);

    if (!permissionGranted) {
      console.log("Bluetooth não autorizado");
      return null;
    }

    // Verifica se o Bluetooth está ligado
    const bluetoothState = await manager.current.state();

    console.log("ESTADO BLUETOOTH:", bluetoothState);

    if (bluetoothState !== State.PoweredOn) {
      console.log("Bluetooth desligado ou indisponível");
      return null;
    }

    console.log("INICIANDO SCAN...");

    // Procura o ESP32 somente quando for necessário conectar
    const device = await encontrarESP();

    console.log("ESP encontrado:", device.name, device.id);

    const deviceConectado = await manager.current.connectToDevice(device.id);

    const conectado = await deviceConectado.isConnected();

    if (conectado) {
      console.log("conectado");
      return deviceConectado;
    }
    else {
      console.log("nao conectado");
      return null;
    }
  }
  catch (error) {
    console.log("erro : ", error);
    return null;
  }
}

  const tamanhodocorte = 9;

  function esperarOK(numero, timeout = 5000) {

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {

        respostaESP.current = null;

        reject(new Error(`Timeout esperando OK:${numero}`));

        }, timeout);

        respostaESP.current = (numeroRecebido) => {

          if (numeroRecebido === numero) {
            clearTimeout(timer);

            respostaESP.current = null;

            resolve();
          }

        };

      });
    }

  async function sendPhotoBluetooth(base64) {
    try {
      const device = await connectBt();

      if (!device) {
        console.log("erro de conexão");
        return;
      }

      await device.discoverAllServicesAndCharacteristics();

      const inscricao = device.monitorCharacteristicForService(
        serviceUUID,
        notifyCharacteristicUUID,
        async (error, characteristic) => {
            if (error) {
                console.error("Erro recebendo : ", error);
                return;
            }

            if (!characteristic?.value) {
            return;
            }

          const mensagem = Buffer.from(characteristic.value, 'base64').toString('utf8').trim();

          if (mensagem.startsWith("OK:")) {
            const numero = parseInt(mensagem.substring(3), 10);

            if (respostaESP.current) {
                respostaESP.current(numero);
              }

              return;
          }

          if (mensagem.startsWith("RESEND:")) {
            const numero = parseInt(mensagem.substring(7), 10);
            console.log("é necessario reenviar");


          const chunk = chunksRef.current[numero];

          if (chunk !== undefined) {
            const data = Buffer.from(chunk).toString("base64");

            const esperandoOK = esperarOK(numero);

            await device.writeCharacteristicWithResponseForService(
                                        serviceUUID,
                                        writeCharacteristicUUID,
                                        data
            );
            await esperandoOK;
          }
          return;
          }
          setResultado(mensagem);


          if (mensagem == "PODRE") {
            console.log("fruta podre");
          }
          else if (mensagem == "BOA") {
            console.log("fruta boa");
          }

        console.log("recebido :D", characteristic.value)
        }
      );

      //eu vou fazer um for para ir de pouco em pouco cortando e enviando pedaços, função async espe
      //ra o processo inteiro ser finalizado para depois continuar o codigo
      //eu te amo função async <3

      //isso aqui é pra por o texto antes da foto pra saber onde começar
      const data = Buffer.from("INICIOAPP").toString("base64");

      await device.writeCharacteristicWithResponseForService(
                  serviceUUID,
                  writeCharacteristicUUID,
                  data
      );
     //isso aqui é pra por um numero antes do chunck pra saber se ta tendo perda de dados
     let numerodochunk = 0;

     for (let i = 0; i < base64.length; i += tamanhodocorte){
        //aqui eu defino a variavel que vai receber a foto cortada ja, junto com os parametros de corte
        const chunk = base64.slice(i, i + tamanhodocorte);

        //isso é pra por o numero antes do chunk, esse ":" é mt importante, é um identificador pro codigo do esp
        const chunkcomnumeroatras = numerodochunk + ":" + chunk;

        chunksRef.current[numerodochunk] = chunkcomnumeroatras

        const data1 = Buffer.from(chunkcomnumeroatras).toString("base64");
        //esse comando espera e escreve no bt o que sera mandado, por meio dos parametros serviceID e characteristic ID

        const esperandoOK = esperarOK(numerodochunk);

        await device.writeCharacteristicWithResponseForService(
                    serviceUUID,
                    writeCharacteristicUUID,
                    data1
        );
        await esperandoOK;
        numerodochunk++;
      }
      //esse é o texto pra finalizar a operação
      const data2 = Buffer.from("FIMAPP").toString("base64");
      await device.writeCharacteristicWithResponseForService(
                  serviceUUID,
                  writeCharacteristicUUID,
                  data2
      );
      inscricao.remove();
      console.log("enviou foto");
    }
    catch (error) {
      console.error("nao enviou/erro :", error);
    }
  }

  async function takePhoto() {
    if (cameraRef.current) {
      const result = await cameraRef.current.takePictureAsync({ base64: true });
      setPhoto(result.uri);

      // apaga o preview da foto
      setTimeout(() => setPhoto(null), 2500);

      // envia a foto via bt usando apos a transcrição pra base 64
      await sendPhotoBluetooth(result.base64);
    }
  }

  function toggleCameraFacing() {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }

  return (

    <View style={styles.container}>
    <Image
              source = {require('./assets/logo.png')}
              style = {{height : 200, width : 200}}
    />
      <View style={styles.buttonRow}>
        <Button title="tirar foto" onPress={takePhoto} />
        <Button title="inverter camera" onPress={toggleCameraFacing} />
      </View>

      <CameraView
        ref={cameraRef}
        style={styles.squareCamera}
        facing={facing}
      />

      <View style = {styles.detalhamento}>
      <Text style = {styles.texto}>{resultado}</Text>
      </View>

      {photo && (
        <Image source={{ uri: photo }} style={styles.preview} />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    gap : 10,
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  squareCamera: {
    width: 300,
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  preview: {
    width: 200,
    height: 200,
    marginTop: 20,
    borderRadius: 10,
  },
  detalhamento : {
    width : 200,
    height : 200,
    backgroundColor : 'black',
    justifyContent : 'center',
    alignItems : 'center',
    borderRadius : 20,
  },
  texto : {
    fontSize : 30,
    color : 'white',
  }
});