#include<stdio.h>
#include<string.h>
#include<stdlib.h>
struct instr{
	char name[10];
	char roll_no[10];
	int no_opd;
	char opd1[10];
	char opd2[10];
	int prefix;
	int mod;
	int sib;
	int displacement;
	int immd;
	char size[10]; 
};

int main()
{
	FILE *opcode = fopen("opcode.txt","r");
	if (!opcode)
	{
		printf("file not found");
		return 1;
	}

	struct instr table[100];
	int n = 0;

	while(fscanf(opcode ,"%[^,],%[^,],%d,%[^,],%[^,],%d,%d,%d,%d,%d,%s\n",table[n].name,table[n].roll_no,&table[n].no_opd,table[n].opd1,table[n].opd2,&table[n].prefix,&table[n].mod,&table[n].sib,&table[n].displacement,&table[n].immd,table[n].size ) == 11)
	{
		n++;
	}
	fclose(opcode);
	for (int i = 0;i < n-1;i++ )
	{
		for (int j = i+1; j < n;j++)
		{
			if(strcmp(table[i].name,table[j].name ) > 0)
			{
				struct instr temp = table[i];
				table[i] = table[j];
				table[j] = temp; 
			}
			else if(strcmp(table[i].name ,table[j].name) == 0)
			{
				if(strcmp(table[i].roll_no,table[j].roll_no) > 0)
				{
					struct instr temp = table[i];
					table[i] = table[j];
					table[j] = temp;
				}

			}	
		}
	} 
	printf("%-10s %-6s %-4s %-10s %-10s %-7s %-7s %-7s %-7s %-7s %-6s\n","name","roll_no","no_opd","opd1","opd2","prefix","mod","sib","displacement","immd","size");

	for (int i = 0; i < n; i++)
	{
		printf("%-10s %-6s %-4d %-10s %-10s %-7d %-7d %-7d %-7d %-7d %-6s\n",table[i].name,table[i].roll_no,table[i].no_opd,table[i].opd1,table[i].opd2,table[i].prefix,table[i].mod,table[i].sib,table[i].displacement,table[i].immd,table[i].size);
	}

	return 0;
}
