/*aqui começa uma putaria generalizada, por causa do BLE do react, tive que mudar pra BLE no esp, o que é um saco, eu nao vou mentir, nao entendi merda nenhuma (eu entendi algumas coisas sim kkk to zuando)
mas pqp, que lixo é esse aqui :sob: ninguem merece, anyways, aqui define o id do servico e das caracteristicas, juntamente as bibliotecas do BLE, tem algumas definições engraçadas que eu nao sei o pq é assim e como
funiona mas só confia, tem essas classes com funções tbm que eu vo te falar, só sei que são chamadas no futuro, de resto eu n sei porra nenhuma*/

//gente eu tento nao copiar da ia, eu tento aprender, mas tem coisas que realmente nao se aprende em 20 minutos, alem do mais o projeto é pra essa terça agora então colaborem :D
//se tiver outro projeto ou isso aqui avançar, eu vou me esforçar pra estudar tudo sobre programação
//MAS MAS eu nao copiei tudo, basicamente a unica coisa que eu copiei 100% foi o bluetooth do esp, e tipo 50% do bluetooth do javascript, de resto eu dei uma lida e "aprendi" rapidamente como faz
//niniguem vai ler isso mas eu me senti no dever de mostrar que eu tive um pouco de esforço e não sou burro - ass. (com amor) El gato

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define RX_CHARACTERISTIC_UUID "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define TX_CHARACTERISTIC_UUID "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
//ponteiros, apontam para os objetos BLE
BLEServer *server;
BLECharacteristic *rxCharacteristic;
BLECharacteristic *txCharacteristic;

bool deviceConnected = false;

//pinos atuadores (botao é so pra testar o funcionamento do auto-falante)
int buzzer = 21;
int b1 = 34;
//essa variavel vai receber e concatenar a foto "chunkada"
String dataemchunks = "";
//essa variavel define se esta chegando chunks
bool recebendo = false;
//variavel que espera o numero do chunk vindo do app
int numeroesperado = 0;
//eu fiz essa variavel só pra ter certeza que nao vai mandar algo picado, pelo menos eu espero :D
String fotocompleta = "";
//variavel q recebe o prompt da ia
String palavrachave = "";

String decoded = "";

//eu tirei a biblioteca base64 pq ela tava bugando dms, resolvi pesquisar sobre como decodificar sem funções, então eu criei uma que faz isso pra mim :D
//essa daqui acha o valor do caracter
int base64Valor(char c) {
  if (c >= 'A' && c <= 'Z') {
    return c - 'A';
  }
  if (c >= 'a' && c <= 'z') {
    return c - 'a' + 26;
  }
  if (c >= '0' && c <= '9') {
    return c - '0' + 52;
  }
  if (c == '+') {
    return 62;
  }
  if (c == '/') {
    return 63;
  }
  return -1;
}
//essa daqui faz a decodificação mesmo, essa porra foi um lixo de fazer/copiar eu n entendi mt coisa, mas gente eu ja falei q eu tento o maximo q eu posso, ainda nao entendi o uso dos ponteiros :(
size_t decodificarBase64(const char *entrada, size_t tamanhoEntrada, unsigned char *saida, size_t tamanhoSaida) {
  int valor = 0;
  int bits = -8;
  size_t tamanhoSaidaAtual = 0;

  for (size_t i = 0; i < tamanhoEntrada; i++) {
    char c = entrada[i];

    if (c == '=') {
      break;
    }

    int valorChar = base64Valor(c);

    if (valorChar == -1) {
      continue;
    }

    valor = (valor << 6) | valorChar;
    bits += 6;

    if (bits >= 0) {
      if (tamanhoSaidaAtual >= tamanhoSaida) {
        break;
      }

      saida[tamanhoSaidaAtual++] = (valor >> bits) & 0xFF;
      bits -= 8;
    }
  }

  return tamanhoSaidaAtual;
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) {
    deviceConnected = true;
    Serial.println("cll conectado");
  }
  void onDisconnect(BLEServer *server) {
    deviceConnected = false;
    Serial.println("cll desconectado");

    server->startAdvertising();
  }
};

void enviarResultado(String app) {
    txCharacteristic->setValue(app.c_str());
    txCharacteristic->notify();
  }

class ReceiveCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) {
    String recebidobt = characteristic->getValue();
    size_t tamanho;
    size_t tamanhoMaximo = (recebidobt.length() * 3) / 4 + 3;

    unsigned char *transcricao = (unsigned char*)malloc(tamanhoMaximo);

    if (transcricao != nullptr) {
      tamanho = decodificarBase64(
        recebidobt.c_str(),
        recebidobt.length(),
        transcricao,
        tamanhoMaximo
      );

      decoded = String((char*)transcricao, tamanho);
    }
    else {
      decoded = "";
    }

    Serial.print("recebido : ");
    Serial.println(recebidobt);

    //isso aqui le o inicio do envio da foto "inicioapp", ai ele vai recebendo e concatenando ate chegar no fim de TODOS os chunks "fimapp"
    //recebendo é true quando tem "inicioapp", entao começa a receber, recebdno é false quando "fimapp", quando ACABA a foto
    if (decoded == "INICIOAPP") {
      dataemchunks = "";
      numeroesperado = 0;
      recebendo = true;

      Serial.println("pronto pra imagem");
    }
    else if (decoded == "FIMAPP") {
      recebendo = false;

      fotocompleta = dataemchunks;

      //2o passo, enviar a string pro pc rodando o script do python
      //esse ini e fin é marcador pra nao ter problema enquanto o python recebe a imagem, ele sabe exatamente onde começar e onde terminar
      Serial.println("INICIOPY");
      Serial.println(fotocompleta);
      Serial.println("FIMPY");
    }
    else if (recebendo) {
      //agr pra receber direitinho, precisa achar o ":" que eu coloquei no app e descobrir o NUMERO da posição dele, tmnc viu n acaba meu trabalho nuncaaaaaaaaaaaaaaaaaaa
      int achador = decoded.indexOf(':');
      //aqui é complicado, tudo tem que estar perfeitamente igual para que nao tenha erros que EU nao quero, ou erros de recebimento de data
      //o ":" é dado como o caracter 1 (não é o primeiro, o primeiro é 0) na memoria, isso aqui checa se o : ta na string, pq != significa (não é igual a), portanto é mais um check pra ver se ta tudo funcionando
      if (achador != -1) {
        //isso aqui é pra ler TUDO antes do ":", então vai do caracter inicial (0) ate o ":", que é o numero eu espero :D
        String checkdenumero = decoded.substring(0, achador);
        //isso deve ser pra ler o conteudo do chunk de tudo pra frente do ":", eu digo deve ser pq é tanta coisa que mexe com memoria, eu nao sou expert
        String conteudochunk = decoded.substring(achador + 1);
        //to int é pra transformar a string em um numero de vdd, um integer, aqui que faz a comparação do valor do chunk pro conteudo
        int numerochunk = checkdenumero.toInt();

        if (numerochunk == numeroesperado) {
          //aqui concatena o conteudo da foto a string que vai ser realmente usada
          dataemchunks += conteudochunk;

          //aqui sobe o contador do numero de chunks esperado
          numeroesperado++;

          //printzinho basico pra manter tudo em ordem
          Serial.print("Numero recebido : ");
          Serial.println(numerochunk);
          enviarResultado("OK:" + String(numerochunk));
        }
        //me recuso a explicar isso, volte pro 2o ano.
        else {
          Serial.print("erro, esperava chunk :");
          Serial.print(numeroesperado);
          Serial.print(" recebido ");
          Serial.println(numerochunk);
          enviarResultado("RESEND:" + String(numeroesperado));
        }
      }
    }

    free(transcricao);
  }
};

void setup() {
  //começa a comunicação entre o esp e o terminal, nomeia o esp(bt), nomeia o esp(bt)
  Serial.begin(115200);
  //inicia o bt com o nome espfrank2
  BLEDevice::init("ESP FRANK2");
  //inicia o servidor
  server = BLEDevice::createServer();
  
  server->setCallbacks(new ServerCallbacks());
  //inicia o serviço dentro do servidor
  BLEService *service = server->createService(SERVICE_UUID);
  //cria caracteristica que aceita data do cll
  rxCharacteristic = service->createCharacteristic(RX_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_WRITE);
  
  rxCharacteristic->setCallbacks(new ReceiveCallbacks());
  //sla é um tipo de notificação
  txCharacteristic = service->createCharacteristic(TX_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_NOTIFY);

  txCharacteristic->addDescriptor(new BLE2902());

  service->start();

  server->getAdvertising()->start();

  Serial.println("BLE esperando conexao...");

  pinMode(buzzer, OUTPUT);
  pinMode(b1, INPUT);

  Serial.println("Sistema iniciado");
}

void loop() {

  // teste do AF, só pra ver se ele e o botao ta funcionando
  if (digitalRead(b1) == LOW) {
    tone(buzzer, 440);
  }
  else {
    tone(buzzer, 880);
  }

  if (Serial.available()) {
  String read = Serial.readStringUntil('\n');
  read.trim();

  if (read == "GOOD") {
    enviarResultado("BOA");
  }
  else if (read == "ROTTEN") {
    enviarResultado("PODRE");
  }
}
  //primeiro pensar em receber do cll pro esp
  // 1o passo, receber a string no bluetooth e guardar no esp
    // aparentemente ele consegue ler o terminal, entao isso facilita
  /*caso seja necessario voltar alguma coisa do python pro esp, só usar esse template de codigo
    Serial.available();
    (tipo de variavel) (nome) = Serial.read***(); *** = tipo de read que vai fazer
  */
}

// sensor : camera
// atuador : buzina = uwfhfisohgklsdhuidfhgsdigfhfd
// vou mandar a real mudei 50% das coisas gomenasai joao-kun - pequena

// dsfuinvdshdssdfusdffsduicvdcuyvsd

// joaoa afonso gay demais
// marcos legal 
// maria paula e duda gay 
// maria isabel pequena
// maria lucia autista  
// o verdadeiro frank foi a amizade que construimos