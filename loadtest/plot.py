import os
import pandas as pd
import matplotlib.pyplot as plt

script_dir = os.path.dirname(os.path.abspath(__file__))
output_dir = os.path.join(script_dir, '..', 'docs', 'evidencias')
os.makedirs(output_dir, exist_ok=True)

scenarios = ['1replica', '3replicas', 'hpa']
colors = {'1replica': 'red', '3replicas': 'blue', 'hpa': 'green'}

plt.figure(figsize=(12, 6))

plt.subplot(1, 2, 1)
for sc in scenarios:
    csv_file = f'resultados_{sc}.csv'
    if os.path.exists(csv_file):
        df = pd.read_csv(csv_file)
        plt.plot(df['VUs'], df['Throughput_ReqS'], marker='o', label=sc, color=colors[sc])

plt.title('Vazão (Throughput) por Cenário')
plt.xlabel('Utilizadores Simultâneos (VUs)')
plt.ylabel('Requisições por Segundo (Req/s)')
plt.grid(True)
plt.legend()

plt.subplot(1, 2, 2)
for sc in scenarios:
    csv_file = f'resultados_{sc}.csv'
    if os.path.exists(csv_file):
        df = pd.read_csv(csv_file)
        plt.plot(df['VUs'], df['Latencia_P95_ms'], marker='s', label=sc, color=colors[sc], linestyle='--')

plt.title('Latência P95 por Cenário')
plt.xlabel('Utilizadores Simultâneos (VUs)')
plt.ylabel('Latência P95 (ms)')
plt.grid(True)
plt.legend()

plt.tight_layout()
output_path = os.path.join(output_dir, 'comparativo_performance.png')
plt.savefig(output_path, dpi=300)
print(f'✅ Gráfico guardado como {output_path}')
