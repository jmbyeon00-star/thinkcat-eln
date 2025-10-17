from typing import Dict, Tuple
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import PreTrainedTokenizerBase
import pandas as pd

class FrameDataset(Dataset):
    def __init__(self, df: pd.DataFrame):
        # df: columns ['patent', 'label']
        self.df = df.reset_index(drop=True)
    def __len__(self): return len(self.df)
    def __getitem__(self, i):
        row = self.df.iloc[i]
        # return row['patent'], int(row['label'])
        return row['source'], int(row['target'])

def build_dataloaders(
    df_train: pd.DataFrame, df_valid: pd.DataFrame,
    tokenizer: PreTrainedTokenizerBase, max_length: int,
    batch_size: int, shuffle: bool
) -> Dict[str, DataLoader]:
    def collate(batch):
        texts, labels = zip(*batch)
        enc = tokenizer(
            list(texts), padding=True, truncation=True,
            max_length=max_length, return_tensors="pt"
        )
        labels = torch.tensor(labels, dtype=torch.long)
        return enc, labels

    loaders = {
        'train': DataLoader(FrameDataset(df_train), batch_size=batch_size, shuffle=shuffle, collate_fn=collate),
        'valid': DataLoader(FrameDataset(df_valid), batch_size=batch_size, shuffle=False, collate_fn=collate),
    }
    return loaders
