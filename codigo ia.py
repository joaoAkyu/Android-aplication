#só pelo cls
import os
import time

# close the Serial Monitor while Python is using the port. ver qq isso significa :(
#pip install serial, pip install torch torchaudio torchvideo (eu acho, olhar no PyTorch dps), pip install transformer
import serial

#tradutor de base64
import base64

#essas 2s importações sao importantes para salvar a imagem na RAM em forma de bytes ao inves de base64
from PIL import Image
from io import BytesIO

#ia importada do transformers
from transformers import pipeline
ia = pipeline("image-text-to-text", model="Qwen/Qwen2.5-VL-3B-Instruct")

#try and except, é um tipo de checagem muito boa que eu aprendi, usada bastante em ERROS PLANEJADOS, por exemplo, vc sabe que o usb nao ta ligado e ainda tenta ligar o programa, ele skipa o TRY e vai direto pro except, fechando o programa
try : 
    #objeto do esp que conecta no terminal
    esp = serial.Serial("COM3", 115200, timeout=1)

except serial.SerialException as erro:
    print(f"NAO DEU PRA COMUNICAR, {erro}")
    exit()

#a foto em b64 ta aqui
fototraduzida = ""

#variavel bool que mantem o codigo rodando pra sempre
#TEM QUE FECHAR MATANDO O TERMINAL
running = True
#print de checagem
print("Codigo Rodando em loop por import time/running = true")

#aqui começa o loop do python, para que ele nao interrompa a comunicação e simplesmente pare depois de algo
while running :
    #isso aqui é usando o objeto para ler e guardar a informação
    boolfoto = True
    while boolfoto :
    #variavel foto recebe data até o \n, decode transforma bytes em string, pq o python recebe em bytes aparentemente :(
    #strip é pra tirar o lixo tipo \n ou " "(espaços)
    #basicamente só recebe a string sem nenhum lixo ou problema de print :D
        foto = esp.readline().decode().strip() 

        if foto == "" :
            continue

        if foto == "INICIOPY" :
            fototraduzida = ""
            continue
    
        if foto == "FIMPY" :
            boolfoto = False
            break

        fototraduzida += foto

    if fototraduzida != "":
        try :
            imagemembytes = base64.b64decode(fototraduzida)
            imagem = Image.open(BytesIO(imagemembytes))
        except Exception as erro :
            print("erro ao construir imagem : ", erro)
            continue


    #se nao tem foto, nao roda a ia, essa ia é visual, então tem um prompt mais bonito e simples de entender
    if fototraduzida != "" :
        messages = [
            {
                "role" : "user",
                "content" : [
                    {"type" : "image", "image" : imagem},
                    {"type" : "text", "text" : "Look at the fruit. Classify it as exactly one of these two labels: rotten or good. Return only one word: rotten or good."}
                ]
            }
        ]
        
        resposta = ia(text=messages)
        os.system('cls')
        print(f"RESP COMPLETA, {resposta}")

        #aqui vem o problema, nao tenho como saber o que a ia esta printando, eu estou REZANDO pra ser isso aqui
        texto = resposta[0]["generated_text"][-1]["content"]
        os.system('cls')
        print(f"TEXTO RECEBIDO, {texto}")

        texto = texto.lower().strip()

        if "rotten" in texto :
            esp.write(b"ROTTEN\n")

        elif "good" in texto :
            esp.write(b"GOOD\n")
        
    else :
        print("erro, não tem a string da foto")

#esse codigo ta uma merda, ta cheio de loops indefinidos e problemas que podem finalizar o codigo (parar de rodar), eu fiz o que eu pude ja que eu nao tenho acesso
#ao projeto e nao tenho experiencia alguma com python, mas eu nao acho que vai dar erro mesmo tendo essa quantidade enorme de problemas e a necessidade de muitos
#debugs :D